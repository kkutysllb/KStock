/**
 * Password hashing for local accounts. Two generations share this module:
 *
 * - The current scheme is scrypt with a per-account salt, encoded as one
 *   self-describing string so a stored hash carries the parameters it was
 *   derived under. The cost keeps one verification in the tens of
 *   milliseconds, which is the only brute-force brake a local server has.
 * - The legacy scheme is KStock 1.x's bcrypt encoding (`$dfv1$` / `$dfv2$` /
 *   bare bcrypt), imported from the retired Python gateway's account store.
 *   Imported hashes verify through bcrypt and upgrade to scrypt on the first
 *   successful sign-in, so an upgrading user's password keeps working.
 * @module @kstock/accounts-local/src/password
 */

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { compareSync } from 'bcryptjs'

const KEY_BYTES = 32
const SALT_BYTES = 16
/** scrypt cost: 2^15 iterations, the interactive-login tier. */
const COST = 32768
const BLOCK_SIZE = 8
const PARALLELISM = 1
// scrypt reserves 128 * N * r bytes (32 MiB at this cost) plus overhead; the
// Node default cap of 32 MiB sits exactly on that boundary.
const MAX_MEMORY_BYTES = 96 * 1024 * 1024
const SCHEME = 'scrypt'
const SEGMENTS = 6

/** 1.x hash of the current generation: bcrypt over the base64 SHA-256 pre-hash. */
const LEGACY_V2_PREFIX = '$dfv2$'
/** 1.x hash of the first generation: plain bcrypt. */
const LEGACY_V1_PREFIX = '$dfv1$'
/** A bare crypt(3)-style bcrypt hash, the 1.x pre-versioning spelling. */
const LEGACY_BARE_BCRYPT = /^\$2[abxy]\$\d{2}\$/

/** One decoded stored hash. */
interface ScryptHash {
  readonly cost: number
  readonly blockSize: number
  readonly parallelism: number
  readonly salt: Buffer
  readonly key: Buffer
}

/** Decode a segment holding a non-negative integer. */
function decodeInteger(value: string | undefined, malformed: () => never): number {
  if (value === undefined || !/^[0-9]+$/u.test(value)) malformed()
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) malformed()
  return parsed
}

/** Decode one canonical base64url segment. */
function decodeSegment(value: string | undefined, malformed: () => never): Buffer {
  if (value === undefined || !/^[A-Za-z0-9_-]+$/u.test(value)) malformed()
  const decoded = Buffer.from(value, 'base64url')
  if (decoded.toString('base64url') !== value) malformed()
  return decoded
}

/**
 * Decode one stored scrypt hash string.
 * @param encoded - the stored value.
 * @returns its parameters, salt, and derived key.
 * @throws Error when the stored value is not a hash this module wrote.
 */
function decodeHash(encoded: string): ScryptHash {
  const malformed = (): never => {
    throw new Error('accounts-local: stored password hash is malformed')
  }
  const segments = encoded.split('$')
  if (segments.length !== SEGMENTS || segments[0] !== SCHEME) malformed()
  return {
    cost: decodeInteger(segments[1], malformed),
    blockSize: decodeInteger(segments[2], malformed),
    parallelism: decodeInteger(segments[3], malformed),
    salt: decodeSegment(segments[4], malformed),
    key: decodeSegment(segments[5], malformed),
  }
}

/** Derive one key under the given parameters. */
function derive(
  password: string,
  salt: Buffer,
  cost: number,
  blockSize: number,
  parallelism: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, {
      N: cost,
      r: blockSize,
      p: parallelism,
      maxmem: MAX_MEMORY_BYTES,
    }, (error, key) => {
      /* v8 ignore next 4 -- node:crypto validates scrypt parameters synchronously and reports every
      rejected parameter by throwing, so the callback's error channel has no reachable input */
      if (error !== null) {
        reject(error)
        return
      }
      resolve(key)
    })
  })
}

/**
 * Whether one stored hash is an imported 1.x bcrypt encoding rather than this
 * generation's scrypt.
 * @param encoded - the stored hash from the account file.
 * @returns true for `$dfv2$`, `$dfv1$`, and bare bcrypt spellings.
 */
export function isLegacyPasswordHash(encoded: string): boolean {
  return encoded.startsWith(LEGACY_V2_PREFIX)
    || encoded.startsWith(LEGACY_V1_PREFIX)
    || LEGACY_BARE_BCRYPT.test(encoded)
}

/** The 1.x v2 pre-hash: base64 SHA-256, dodging bcrypt's 72-byte input limit. */
function legacyPreHashV2(password: string): string {
  return createHash('sha256').update(password, 'utf8').digest('base64')
}

/**
 * Verify one password against an imported 1.x bcrypt hash. A malformed or
 * corrupt hash fails closed instead of throwing, mirroring the old gateway.
 * @param password - the submitted plaintext password.
 * @param encoded - the stored legacy hash.
 * @returns true only when the password matches.
 */
export function verifyLegacyPassword(password: string, encoded: string): boolean {
  try {
    if (encoded.startsWith(LEGACY_V2_PREFIX)) {
      return compareSync(legacyPreHashV2(password), encoded.slice(LEGACY_V2_PREFIX.length))
    }
    const bcryptHash = encoded.startsWith(LEGACY_V1_PREFIX)
      ? encoded.slice(LEGACY_V1_PREFIX.length)
      : encoded
    return compareSync(password, bcryptHash)
  } catch {
    // bcryptjs rejects malformed salts; that is corrupt data, not a credential.
    return false
  }
}

/**
 * Derive the stored representation of one password.
 * @param password - the plaintext password.
 * @returns the encoded hash, salt and parameters included.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELISM)
  return [
    SCHEME,
    String(COST),
    String(BLOCK_SIZE),
    String(PARALLELISM),
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

/**
 * Verify one password against a stored hash, in constant time. Imported 1.x
 * hashes take the bcrypt path; everything else must be a hash this module
 * wrote.
 * @param password - the submitted plaintext password.
 * @param encoded - the stored hash from the account file.
 * @returns true only when the derived key matches the stored key.
 * @throws Error when the stored value is not a verifiable hash.
 */
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (isLegacyPasswordHash(encoded)) return verifyLegacyPassword(password, encoded)
  const stored = decodeHash(encoded)
  const key = await derive(password, stored.salt, stored.cost, stored.blockSize, stored.parallelism)
  return key.byteLength === stored.key.byteLength && timingSafeEqual(key, stored.key)
}
