/**
 * @kstock/accounts-local — KStock 的本地账户面，fork 自
 * `@qilin/accounts-local` 3.0.0（MIT）：一个账户文件、scrypt 密码哈希、
 * 签名 HttpOnly 会话 cookie、`/api/auth` 端点，以及浏览器传输层的
 * 账户会话门。
 *
 * KStock 叠加：老版 1.x（Python gateway）账户迁移。旧账户存放在旧引擎
 * SQLite（users 表，bcrypt 哈希）——启动时空账户文件则全量导入；登录时
 * 未命中的标识回退到旧账户表按需导入；导入的 bcrypt 哈希可验证，首次
 * 登录成功后透明升级为 scrypt。账户门限对一个 harness home 的访问，
 * 不是多租户边界。
 * @module @kstock/accounts-local
 */

import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import type { ConnectionTrustRequest, Context, CredentialRecord } from './kylin.ts'
import { AccountStore, type AccountRecord } from './accounts.ts'
import { createSessionAuthority } from './gate.ts'
import { primeLegacyAccountCache, legacyAccounts } from './legacy.ts'
import { isRecord } from './json.ts'
import { createAuthRoutes } from './routes.ts'
import { SessionCookies } from './session.ts'
import { resolveQilinHome } from './vendor/home-paths.ts'

export { AUTH_API_PREFIX, LOGIN_PATH, SETUP_PATH } from './paths.ts'

/** Stable Cordis plugin name. */
export const name = 'accounts-local'

/** Services required before the account surface can mount. */
export const inject = ['connection', 'credentials']

/** Browser-session signing secret held by the credential provider. */
const SESSION_SECRET_KEY = 'accounts-local/session-secret'

/** Stored secret payload version. */
const SECRET_VERSION = 1
const SECRET_BYTES = 32
const DAY_MILLISECONDS = 24 * 60 * 60 * 1000

/** Plugin config: the account surface's deployment choices. */
export interface Config {
  /**
   * Require an account session for every gated index document and every
   * `/api` request. A disabled gate leaves the endpoints mounted and returns
   * the launch-token authentication of the transport in its place.
   * @default true
   */
  enabled?: boolean
  /**
   * Whether an anonymous visitor may create an additional account. An open
   * registration lets anyone who can reach this server use the harness, so a
   * deployment binding beyond loopback closes it.
   * @default 'open'
   */
  registration?: 'open' | 'closed'
  /** Absolute browser-session lifetime in days. @default 7 */
  sessionMaxAgeDays?: number
  /** Explicit harness home; omitted follows `QILIN_HOME`, then `~/.qilin`. */
  qilinHome?: string
}

/** Apply the config defaults the upstream schema declared. */
function parseConfig(config: Config | undefined): {
  enabled: boolean
  registration: 'open' | 'closed'
  sessionMaxAgeDays: number
  qilinHome: string | undefined
} {
  return {
    enabled: config?.enabled ?? true,
    registration: config?.registration === 'closed' ? 'closed' : 'open',
    sessionMaxAgeDays: typeof config?.sessionMaxAgeDays === 'number'
      && Number.isSafeInteger(config.sessionMaxAgeDays) && config.sessionMaxAgeDays >= 1
      ? config.sessionMaxAgeDays
      : 7,
    qilinHome: typeof config?.qilinHome === 'string' ? config.qilinHome : undefined,
  }
}

/**
 * Account file of one harness home.
 * @param qilinHome - absolute harness home.
 * @returns the absolute account file path.
 */
export function accountsFilePath(qilinHome: string): string {
  return join(qilinHome, 'auth', 'accounts.json')
}

/**
 * Load this deployment's session signing secret, creating it on first run.
 * @param credentials - the harness credential provider.
 * @returns the HMAC key every session cookie is signed with.
 * @throws Error when the stored record is not a secret this package wrote.
 */
async function loadSessionSecret(credentials: Context['credentials']): Promise<Buffer> {
  const record: CredentialRecord | undefined = await credentials.modifyRecord(
    SESSION_SECRET_KEY,
    (current) => {
      if (current !== undefined) return Promise.resolve(undefined)
      return Promise.resolve({
        kind: 'grant',
        payload: { version: SECRET_VERSION, secret: randomBytes(SECRET_BYTES).toString('base64url') },
      })
    },
  )
  if (record === undefined) throw new Error('accounts-local: session secret was not stored')
  if (record.kind !== 'grant' || !isRecord(record.payload)
    || record.payload.version !== SECRET_VERSION || typeof record.payload.secret !== 'string') {
    throw new Error('accounts-local: stored session secret has an unsupported format')
  }
  const secret = Buffer.from(record.payload.secret, 'base64url')
  // The canonical re-encoding is the length check's companion: base64url decodes
  // several spellings of one byte string, and only the spelling this package
  // wrote may pass.
  if (secret.byteLength !== SECRET_BYTES || secret.toString('base64url') !== record.payload.secret) {
    throw new Error('accounts-local: stored session secret is not a canonical 32-byte base64url key')
  }
  return secret
}

/**
 * Bring 1.x accounts into an empty account file: an upgrading installation
 * then presents the sign-in document (not first-run setup) and every old
 * account can sign in with its existing password.
 * @param store - the freshly opened (empty) account set.
 */
async function importLegacyAccountsWhenEmpty(store: AccountStore): Promise<void> {
  primeLegacyAccountCache()
  if (!store.isEmpty) return
  for (const legacy of legacyAccounts()) {
    if (store.byUsername(legacy.email) !== undefined || store.byEmail(legacy.email) !== undefined) continue
    await store.addImported(
      { username: legacy.email, email: legacy.email },
      legacy.passwordHash,
      legacy.createdAt,
      legacy.tokenVersion,
    )
  }
}

/**
 * Mount the account surface: the authentication endpoints, and — when the gate
 * is enabled — the session authority the transport enforces.
 * @param ctx - plugin context carrying the connection and credential services.
 * @param config - validated {@link Config}.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const parsed = parseConfig(config)
  const store = await AccountStore.open(accountsFilePath(resolveQilinHome(parsed.qilinHome)))
  // 1.x 迁移：空账户文件先把旧账户带进来（读取失败安静跳过，不影响启动）。
  try {
    await importLegacyAccountsWhenEmpty(store)
  } catch {
    // 迁移是增强而非前提：旧库不可读时按全新安装继续。
  }
  const sessions = new SessionCookies(
    await loadSessionSecret(ctx.credentials),
    parsed.sessionMaxAgeDays * DAY_MILLISECONDS,
  )
  const currentAccount = (request: ConnectionTrustRequest): AccountRecord | undefined => {
    const payload = sessions.read(request)
    if (payload === undefined) return undefined
    const account = store.byId(payload.subject)
    // A credential change bumps the generation; a cookie minted before it stops
    // naming an account even though its signature still verifies.
    return account !== undefined && account.tokenVersion === payload.tokenVersion ? account : undefined
  }
  for (const route of createAuthRoutes({
    store,
    sessions,
    currentAccount,
    enabled: parsed.enabled,
    registration: parsed.registration,
  })) {
    ctx.connection.fetch.register(route)
  }
  if (parsed.enabled) {
    ctx.connection.session.install(createSessionAuthority({ currentAccount }))
  }
}
