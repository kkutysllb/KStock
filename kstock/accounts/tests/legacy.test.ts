/**
 * 1.x 账户迁移单元测试：bcrypt 两代哈希识别与验证、scrypt 回归、
 * addImported 落盘、旧库读取过滤、登录路由的迁移分支。
 */
import { strict as assert } from 'node:assert'
import { beforeEach, suite, test } from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { hashSync } from 'bcryptjs'
import { AccountStore } from '../src/accounts.ts'
import {
  hashPassword,
  isLegacyPasswordHash,
  verifyLegacyPassword,
  verifyPassword,
} from '../src/password.ts'
import { legacyDatabasePaths, legacyAccounts, primeLegacyAccountCache } from '../src/legacy.ts'
import { createAuthRoutes } from '../src/routes.ts'
import { SessionCookies } from '../src/session.ts'

/** 1.x v2 口令哈希：$dfv2$ + bcrypt(b64(sha256(pw)))。 */
function legacyV2Hash(password: string): string {
  const preHash = createHash('sha256').update(password, 'utf8').digest('base64')
  return `$dfv2$${hashSync(preHash, 4)}`
}

/** 1.x v1 口令哈希：$dfv1$ + bcrypt(pw)。 */
function legacyV1Hash(password: string): string {
  return `$dfv1$${hashSync(password, 4)}`
}

suite('password：1.x bcrypt 识别与验证', () => {
  test('三代 1.x 拼写都被识别为 legacy', () => {
    assert.equal(isLegacyPasswordHash(legacyV2Hash('x')), true)
    assert.equal(isLegacyPasswordHash(legacyV1Hash('x')), true)
    assert.equal(isLegacyPasswordHash('$2b$12$abcdefghijklmnopqrstuv'), true)
    assert.equal(isLegacyPasswordHash('scrypt$32768$8$1$abc$def'), false)
  })

  test('v2 哈希验证：正确口令通过，错误口令拒绝', () => {
    const encoded = legacyV2Hash('旧版密码-secret')
    assert.equal(verifyLegacyPassword('旧版密码-secret', encoded), true)
    assert.equal(verifyLegacyPassword('wrong-password', encoded), false)
  })

  test('v1 与裸 bcrypt 哈希验证', () => {
    const v1 = legacyV1Hash('plain-password1')
    assert.equal(verifyLegacyPassword('plain-password1', v1), true)
    assert.equal(verifyLegacyPassword('plain-password1', v1.slice('$dfv1$'.length)), true)
    assert.equal(verifyLegacyPassword('other', v1), false)
  })

  test('畸形哈希失败关闭（不抛异常）', () => {
    assert.equal(verifyLegacyPassword('x', '$dfv2$not-a-bcrypt'), false)
    assert.equal(verifyLegacyPassword('x', '$dfv1$'), false)
  })

  test('scrypt 回归：hashPassword/verifyPassword 往返', async () => {
    const encoded = await hashPassword('current-password')
    assert.equal(isLegacyPasswordHash(encoded), false)
    assert.equal(await verifyPassword('current-password', encoded), true)
    assert.equal(await verifyPassword('other', encoded), false)
  })

  test('verifyPassword 分发：legacy 哈希走 bcrypt 路径', async () => {
    const encoded = legacyV2Hash('migrated-password')
    assert.equal(await verifyPassword('migrated-password', encoded), true)
    assert.equal(await verifyPassword('other', encoded), false)
  })

  test('v2 长口令（超过 bcrypt 72 字节截断线）照常验证', () => {
    const longPassword = '长'.repeat(60)
    const encoded = legacyV2Hash(longPassword)
    assert.equal(verifyLegacyPassword(longPassword, encoded), true)
  })
})

suite('legacy：旧库读取与发现', () => {
  let fixtureDir: string
  let databasePath: string
  let savedAppDataDir: string | undefined

  beforeEach(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), 'kstock-legacy-test-'))
    databasePath = join(fixtureDir, 'qilin.db')
    savedAppDataDir = process.env['KSTOCK_APP_DATA_DIR']
    process.env['KSTOCK_APP_DATA_DIR'] = fixtureDir
    const database = new DatabaseSync(databasePath)
    database.exec(`CREATE TABLE users (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      email VARCHAR(320) NOT NULL,
      password_hash VARCHAR(128),
      system_role VARCHAR(16) NOT NULL,
      created_at DATETIME NOT NULL,
      oauth_provider VARCHAR(32),
      oauth_id VARCHAR(128),
      needs_setup BOOLEAN NOT NULL,
      token_version INTEGER NOT NULL
    )`)
    database.prepare(
      'INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run('uuid-admin', 'Admin@Example.com', legacyV2Hash('admin-password-1'), 'admin', '2026-08-14 12:08:04.291775', null, null, 0, 0)
    database.prepare(
      'INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run('uuid-oauth', 'oauth@example.com', legacyV1Hash('oauth-password'), 'user', '2026-08-15 00:00:00', 'oidc', 'oidc-1', 0, 1)
    database.prepare(
      'INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run('uuid-empty', 'empty@example.com', null, 'user', '2026-08-15 00:00:00', null, null, 1, 1)
    database.close()
    process.env['KSTOCK_LEGACY_ACCOUNTS_DB'] = databasePath
  })

  test('发现：显式覆盖路径生效', () => {
    assert.deepEqual(legacyDatabasePaths(), [databasePath])
  })

  test('读取：只带可登录的本地账户，邮箱归一化小写', () => {
    primeLegacyAccountCache()
    const accounts = legacyAccounts()
    assert.equal(accounts.length, 1)
    assert.equal(accounts[0]?.email, 'admin@example.com')
    assert.equal(accounts[0]?.tokenVersion, 0)
    assert.equal(accounts[0]?.createdAt, Date.UTC(2026, 7, 14, 12, 8, 4, 291))
    assert.equal(isLegacyPasswordHash(accounts[0]?.passwordHash ?? ''), true)
  })

  test('按需导入登录分支：旧口令登录成功并落为 scrypt 账户', async () => {
    const home = mkdtempSync(join(tmpdir(), 'kstock-accounts-test-'))
    try {
      const store = await AccountStore.open(join(home, 'accounts.json'))
      const sessions = new SessionCookies(Buffer.alloc(32, 7), 7 * 24 * 60 * 60 * 1000)
      const login = createAuthRoutes({
        store,
        sessions,
        currentAccount: () => undefined,
        enabled: true,
        registration: 'closed',
      })[3]
      assert.ok(login)
      primeLegacyAccountCache()
      const response = await login.fetch({
        json: async () => ({ identifier: 'admin@example.com', password: 'admin-password-1' }),
        headers: new Headers({ host: '127.0.0.1:18001' }),
      } as unknown as Request)
      assert.equal(response.status, 200)
      assert.match(response.headers.get('set-cookie') ?? '', /^qilin-session-/)
      // 账户已入库且是 scrypt（口令原样延续，代数重置为本代）。
      const created = store.byEmail('admin@example.com')
      assert.ok(created)
      assert.equal(isLegacyPasswordHash(created.password), false)
      assert.match(created.password, /^scrypt\$/)
      assert.equal(await verifyPassword('admin-password-1', created.password), true)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test('按需导入登录分支：旧口令错误时拒绝且不入账', async () => {
    const home = mkdtempSync(join(tmpdir(), 'kstock-accounts-test-'))
    try {
      const store = await AccountStore.open(join(home, 'accounts.json'))
      const sessions = new SessionCookies(Buffer.alloc(32, 7), 7 * 24 * 60 * 60 * 1000)
      const login = createAuthRoutes({
        store,
        sessions,
        currentAccount: () => undefined,
        enabled: true,
        registration: 'closed',
      })[3]
      assert.ok(login)
      primeLegacyAccountCache()
      const response = await login.fetch({
        json: async () => ({ identifier: 'admin@example.com', password: 'wrong-password' }),
        headers: new Headers({ host: '127.0.0.1:18001' }),
      } as unknown as Request)
      assert.equal(response.status, 401)
      assert.equal(store.byEmail('admin@example.com'), undefined)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  test('清理：删除显式覆盖，还原数据目录，移除临时旧库夹具', () => {
    delete process.env['KSTOCK_LEGACY_ACCOUNTS_DB']
    if (savedAppDataDir === undefined) delete process.env['KSTOCK_APP_DATA_DIR']
    else process.env['KSTOCK_APP_DATA_DIR'] = savedAppDataDir
    rmSync(fixtureDir, { recursive: true, force: true })
  })
})

suite('accounts：addImported 落盘', () => {
  test('导入记录持久化并可再次打开', async () => {
    const home = mkdtempSync(join(tmpdir(), 'kstock-accounts-test-'))
    try {
      const path = join(home, 'accounts.json')
      const store = await AccountStore.open(path)
      const created = await store.addImported(
        { username: 'admin@example.com', email: 'admin@example.com' },
        legacyV2Hash('irrelevant'),
        Date.UTC(2026, 7, 14),
        0,
      )
      assert.equal(store.isEmpty, false)
      const reopened = await AccountStore.open(path)
      assert.deepEqual(reopened.byId(created.id), created)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
