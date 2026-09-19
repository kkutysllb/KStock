/**
 * Shared filesystem path helpers for QiLin user data.
 *
 * Vendored verbatim (subset) from `@qilin/home-paths` 3.0.0
 * (packages/util/home-paths/src/index.ts, MIT): only the home-resolution half
 * this package needs; the watcher-canonicalization helpers stay upstream.
 * @module @kstock/accounts-local/src/vendor/home-paths
 */

import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/** Directory name for the default QiLin home under the OS home. */
export const QILIN_HOME_DIR_NAME = '.qilin'

/** Environment variable that overrides the default QiLin home. */
export const QILIN_HOME_ENV = 'QILIN_HOME'

/**
 * Resolve the default QiLin home using Node's platform path rules.
 * @returns the absolute default harness home path.
 */
export function defaultQilinHome(): string {
  return join(homedir(), QILIN_HOME_DIR_NAME)
}

/**
 * Expand supported tilde prefixes against the operating-system home.
 * @param path - configured path that may begin with `~`, `~/`, or `~\`.
 * @returns the expanded path, or the original value when no supported prefix is present.
 */
export function expandHomePath(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

/**
 * Resolve the single-root QiLin home.
 *
 * Precedence, highest first: an explicit configured path, `$QILIN_HOME`, then
 * `~/.qilin`. The harness keeps all user data under one root. An empty or
 * whitespace-only `$QILIN_HOME` is treated as unset, so a blank override never
 * resolves the home to the current working directory.
 * @param configured - explicit harness-home override, which has highest precedence.
 * @param env - environment mapping used to read `QILIN_HOME`.
 * @returns the normalized absolute harness home path.
 */
export function resolveQilinHome(configured?: string, env: Record<string, string | undefined> = process.env): string {
  const fromEnv = env[QILIN_HOME_ENV]
  const selected = configured ?? (fromEnv !== undefined && fromEnv.trim().length > 0 ? fromEnv : defaultQilinHome())
  return resolve(expandHomePath(selected))
}
