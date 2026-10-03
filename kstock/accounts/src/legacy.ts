/**
 * KStock 1.x（Python gateway）账户迁移读取端。
 *
 * 老引擎把用户放在共享 SQLite（qilin.db，`users` 表：email + bcrypt 哈希），
 * 位置由老版 `~/.kstock/config/qilin.runtime.yaml` 的 `database.sqlite_dir`
 * 显式记录。这里只读：直接只读打开，失败时把主库文件拷贝到临时目录再开，
 * 绝不写旧库、不碰 -wal/-shm。账户缓存在进程内只探测一次（旧应用升级后
 * 即退役，不会再产生新账户）。
 * @module @kstock/accounts-local/src/legacy
 */

import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { isLegacyPasswordHash } from './password.ts'

/** 一条从 1.x 读出的可导入账户。 */
export interface LegacyAccount {
  /** 归一化（小写）邮箱，1.x 唯一的登录标识。 */
  readonly email: string
  /** 旧库原样 bcrypt 哈希（`$dfv2$…` / `$dfv1$…` / 裸 bcrypt）。 */
  readonly passwordHash: string
  /** 账户创建时间（epoch 毫秒，旧库存 UTC）。 */
  readonly createdAt: number
  /** 旧凭据代数，原样带入。 */
  readonly tokenVersion: number
}

/** 用户数据根目录：与老 gateway / 量化插件同一解析（KSTOCK_APP_DATA_DIR 优先）。 */
function appDataRoot(): string {
  const override = process.env.KSTOCK_APP_DATA_DIR
  return override !== undefined && override.trim() !== '' ? override : join(homedir(), '.kstock')
}

/** 从老版 runtime.yaml 抠出 `database.sqlite_dir`（文件是平铺 YAML，行扫即可）。 */
function sqliteDirFromRuntimeYaml(root: string): string | undefined {
  const path = join(root, 'config', 'qilin.runtime.yaml')
  try {
    const match = /^\s*sqlite_dir:\s*(.+)\s*$/m.exec(readFileSync(path, 'utf8'))
    const dir = match?.[1]?.trim().replace(/^["']|["']$/g, '')
    return dir !== undefined && dir !== '' ? dir : undefined
  } catch {
    return undefined
  }
}

/** 老库候选路径，按可信度排序。 */
export function legacyDatabasePaths(): string[] {
  const explicit = process.env.KSTOCK_LEGACY_ACCOUNTS_DB
  const root = appDataRoot()
  const candidates = [
    explicit !== undefined && explicit.trim() !== '' ? explicit : undefined,
    sqliteDirFromRuntimeYaml(root) === undefined ? undefined : join(sqliteDirFromRuntimeYaml(root) as string, 'qilin.db'),
    join(root, 'runtime', 'qilin', 'data', 'qilin.db'),
  ]
  return candidates.filter((path): path is string => path !== undefined && existsSync(path))
}

/**
 * 解析 1.x 的 UTC 时间戳（`YYYY-MM-DD HH:MM:SS[.ffffff]`）。SQLite 丢时区，
 * 老端写入前统一转 UTC，这里按 UTC 读回；解析不了的行用当前时刻兜底。
 */
function parseLegacyTimestamp(value: unknown): number {
  if (typeof value !== 'string') return Date.now()
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/
    .exec(value.trim())
  if (match === null) return Date.now()
  const [, y, mo, d, h, mi, s, fraction] = match
  const millis = Number.parseInt((fraction ?? '0').slice(0, 3).padEnd(3, '0'), 10)
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), millis)
}

/** 只读打开老库；直接打开失败（活动 WAL / 权限）时把主库文件拷到临时目录再开。 */
function openReadOnly(databasePath: string): { database: DatabaseSync; cleanup(): void } {
  try {
    return { database: new DatabaseSync(databasePath, { readOnly: true }), cleanup: () => {} }
  } catch {
    const temp = join(tmpdir(), `kstock-legacy-accounts-${process.pid}-${Date.now()}.db`)
    copyFileSync(databasePath, temp)
    try {
      return { database: new DatabaseSync(temp, { readOnly: true }), cleanup: () => rmSync(temp, { force: true }) }
    } catch (error) {
      rmSync(temp, { force: true })
      throw error
    }
  }
}

/** 从一个老库读出全部可导入账户。老库不是预期的形态（无 users 表）返回空。 */
function readLegacyAccounts(databasePath: string): LegacyAccount[] {
  let handle: ReturnType<typeof openReadOnly>
  try {
    handle = openReadOnly(databasePath)
  } catch {
    return []
  }
  const { database, cleanup } = handle
  try {
    const rows = database.prepare(
      'SELECT email, password_hash, created_at, token_version FROM users'
      + " WHERE password_hash IS NOT NULL AND password_hash != '' AND oauth_provider IS NULL",
    ).all() as Array<Record<string, unknown>>
    const accounts = new Map<string, LegacyAccount>()
    for (const row of rows) {
      const email = typeof row['email'] === 'string' ? row['email'].trim().toLowerCase() : ''
      const passwordHash = typeof row['password_hash'] === 'string' ? row['password_hash'] : ''
      // 只带可验证的 1.x bcrypt 哈希；其余格式（理论上不存在）无法登录，不带。
      if (email === '' || !isLegacyPasswordHash(passwordHash) || accounts.has(email)) continue
      accounts.set(email, {
        email,
        passwordHash,
        createdAt: parseLegacyTimestamp(row['created_at']),
        tokenVersion: typeof row['token_version'] === 'number' && Number.isSafeInteger(row['token_version'])
          ? row['token_version']
          : 1,
      })
    }
    return [...accounts.values()]
  } catch {
    // 表缺失 / 库损坏：视为无旧账户。
    return []
  } finally {
    database.close()
    cleanup()
  }
}

type Cache = { readonly state: 'unprobed' } | { readonly state: 'probed'; readonly accounts: readonly LegacyAccount[] }

let cache: Cache = { state: 'unprobed' }

/**
 * 探测一次老库并缓存账户表。引擎启动时调用；找不到老库或读取失败都安静
 * 地落空（全新安装的正常路径）。显式指定 KSTOCK_LEGACY_ACCOUNTS_DB 时跳过
 * 缓存（测试钩子）。
 */
export function primeLegacyAccountCache(): void {
  const explicit = process.env.KSTOCK_LEGACY_ACCOUNTS_DB
  if (cache.state === 'probed' && (explicit === undefined || explicit.trim() === '')) return
  const databasePath = legacyDatabasePaths()[0]
  const accounts = databasePath === undefined ? [] : readLegacyAccounts(databasePath)
  cache = { state: 'probed', accounts }
}

/** 缓存里的全部 1.x 账户（未探测/无老库时为空）。 */
export function legacyAccounts(): readonly LegacyAccount[] {
  primeLegacyAccountCache()
  return cache.state === 'probed' ? cache.accounts : []
}

/** 按登录标识（归一化邮箱）取一条 1.x 账户。 */
export function legacyAccountByIdentifier(identifier: string): LegacyAccount | undefined {
  return legacyAccounts().find(account => account.email === identifier)
}
