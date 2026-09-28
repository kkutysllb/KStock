/**
 * KStock 量化三库存储：策略 / 因子 / 选股，一份泛化实现按配置实例化。
 *
 * 从 1.x `scripts/kstock_{strategies,factors,selections}.py` 忠实移植：
 * 表名 / 列名 / 索引 / 文件布局与旧 `product/kstock.db` 完全兼容，
 * 用户既有数据无需迁移。三库同构（实体 + 版本链 + 运行记录），
 * 差异以声明式配置表达，共享一份 CRUD 实现。
 */

import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type SQLInputValue, DatabaseSync } from 'node:sqlite'

export class StoreError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

function now(): string {
  return new Date().toISOString()
}

function shortRandom(prefix: string): string {
  return `${prefix}${randomBytes(6).toString('hex')}`
}

/** 版本链的产物形态：策略/因子存代码文件，选股存 criteria JSON。 */
interface VersionShape {
  /** 版本表的摘要列对（sha 摘要 + 字节数）；选股无代码、只有 criteria_json/criteria_bytes。 */
  digest?: { shaColumn: string; bytesColumn: string; file: string }
  /** 版本表里 content 列对（json 存库 + bytes 列），选股 criteria 用。 */
  content?: { jsonColumn: string; bytesColumn: string; payloadKey: string }
}

/** 运行记录的附件形态：落盘文件 + 读取端点。 */
interface RunAttachment {
  /** 请求体字段名（也是读取端点名）。 */
  key: string
  /** 运行表的路径列（如 equity_path / ic_series_path / report_path）。 */
  pathColumn: string
  /** 落盘文件名。 */
  file: string
  /** 大小上限（字节）。 */
  limit: number
  /** 文本附件（选股报告 markdown）按文本读写并原样返回字符串。 */
  text?: boolean
}

export interface LibraryConfig {
  /** URL 段与实体主键后缀（strategies / factors / selections）。 */
  key: 'strategy' | 'factor' | 'selection'
  /** 实体 id 前缀（stg_ / fac_ / sel_）。 */
  idPrefix: string
  /** 运行 id 前缀（srun_ / frun_ / selrun_）。 */
  runIdPrefix: string
  entityTable: string
  versionTable: string
  runsTable: string
  /** 实体状态合法值（PATCH 校验）。 */
  statusValues: string[]
  /** 默认状态（建实体时）。 */
  defaultStatus: string
  /**
   * 实体附加文本列。1.x 三库实体列并不一致（策略/因子有 hypothesis，
   * 选股没有——只有 criteria），因此按库声明，保持与既有表逐列兼容。
   */
  entityTextColumns: { column: string; defaultValue: string; updatable?: boolean }[]
  /** 版本链产物形态。 */
  version: VersionShape
  /** 运行记录的额外文本列（策略无 / 因子 universe / 选股 trade_date+universe）。 */
  runTextColumns?: string[]
  /** 运行记录的 JSON 列（rules/config + metrics）。 */
  runJsonColumns: { column: string; bodyKey: string }[]
  /** 运行附件。 */
  runAttachments: RunAttachment[]
}

export class LibraryStore {
  private readonly db: DatabaseSync
  readonly libraryRoot: string

  constructor(private readonly config: LibraryConfig, dataRoot: string) {
    const root = join(dataRoot, 'product')
    const dirByPrefix: Record<string, string> = {
      strategy: 'strategies',
      factor: 'factors',
      selection: 'selections',
    }
    this.libraryRoot = join(root, dirByPrefix[config.key] ?? config.key)
    mkdirSync(this.libraryRoot, { recursive: true })
    this.db = new DatabaseSync(join(root, 'kstock.db'))
    this.db.exec('PRAGMA journal_mode = WAL')
    this.initialize()
  }

  /** 释放 SQLite 句柄：删除临时库（Windows 文件锁）前必须先关。 */
  close(): void {
    this.db.close()
  }

  private initialize(): void {
    const c = this.config
    const key = `${c.key}_id`
    const textColumns = c.entityTextColumns.map(({ column, defaultValue }) => `${column} TEXT NOT NULL DEFAULT '${defaultValue}'`)
    const versionArtifact = c.version.digest
      ? `${c.version.digest.shaColumn} TEXT NOT NULL,\n        ${c.version.digest.bytesColumn} INTEGER NOT NULL,`
      : ''
    const versionContent = c.version.content
      ? `${c.version.content.jsonColumn} TEXT NOT NULL,\n        ${c.version.content.bytesColumn} INTEGER NOT NULL,`
      : ''
    const runText = (c.runTextColumns ?? []).map(column => `${column} TEXT NOT NULL DEFAULT ''`)
    const runJson = c.runJsonColumns.map(({ column }) => `${column} TEXT NOT NULL`)
    const runAttachmentPaths = c.runAttachments.map(({ pathColumn }) => `${pathColumn} TEXT`)
    // 非空片段统一以逗号拼接，避免空配置段造成 SQL 语法错误。
    const runColumns = [...runText, ...runJson, ...runAttachmentPaths].map(column => `        ${column}`).join(',\n')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${c.entityTable} (
        user_id TEXT NOT NULL,
        ${key} TEXT NOT NULL,
        name TEXT NOT NULL,
        ${textColumns.length ? textColumns.map(column => `${column},`).join('\n        ') + '\n        ' : ''}status TEXT NOT NULL DEFAULT '${c.defaultStatus}',
        current_version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, ${key})
      );
      CREATE TABLE IF NOT EXISTS ${c.versionTable} (
        user_id TEXT NOT NULL,
        ${key} TEXT NOT NULL,
        version INTEGER NOT NULL,
        parent_version INTEGER,
        ${versionArtifact}
        ${versionContent}
        params_json TEXT NOT NULL,
        change_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, ${key}, version)
      );
      CREATE TABLE IF NOT EXISTS ${c.runsTable} (
        user_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        ${key} TEXT NOT NULL,
        version INTEGER NOT NULL,
        ${runColumns},
        thread_id TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, run_id)
      );
      CREATE INDEX IF NOT EXISTS idx_${c.versionTable} ON ${c.versionTable} (user_id, ${key}, version);
      CREATE INDEX IF NOT EXISTS idx_${c.runsTable} ON ${c.runsTable} (user_id, ${key}, version, created_at);
    `)
  }

  private dir(userId: string, entityId: string): string {
    return join(this.libraryRoot, userId, entityId)
  }

  // ── 实体 ──────────────────────────────────────────────────────────

  create(userId: string, name: string, textValues: Record<string, string> = {}): Record<string, unknown> {
    if (!name.trim()) throw new StoreError(422, '名称不能为空')
    const c = this.config
    const id = shortRandom(c.idPrefix)
    const ts = now()
    const columns = c.entityTextColumns.map(({ column }) => column)
    const values = columns.map(column => textValues[column] ?? c.entityTextColumns.find(item => item.column === column)!.defaultValue)
    this.db.prepare(
      `INSERT INTO ${c.entityTable} (user_id, ${c.key}_id, name${columns.length ? ', ' + columns.join(', ') : ''}, status, current_version, created_at, updated_at)
       VALUES (?, ?, ?${columns.length ? ', ' + columns.map(() => '?').join(', ') : ''}, ?, 0, ?, ?)`,
    ).run(userId, id, name.trim(), ...values, c.defaultStatus, ts, ts)
    return this.get(userId, id)
  }

  get(userId: string, entityId: string): Record<string, unknown> {
    const row = this.db.prepare(
      `SELECT * FROM ${this.config.entityTable} WHERE user_id = ? AND ${this.config.key}_id = ?`,
    ).get(userId, entityId) as Record<string, unknown> | undefined
    if (row === undefined) throw new StoreError(404, `条目不存在：${entityId}`)
    return row
  }

  list(userId: string): Record<string, unknown>[] {
    const rows = this.db.prepare(
      `SELECT * FROM ${this.config.entityTable} WHERE user_id = ? ORDER BY updated_at DESC`,
    ).all(userId) as Record<string, unknown>[]
    return rows.map(row => ({ ...row, latest_run: this.latestRun(userId, String(row[`${this.config.key}_id`])) }))
  }

  update(userId: string, entityId: string, patch: { name?: string; status?: string; text?: Record<string, string> }): Record<string, unknown> {
    const c = this.config
    this.get(userId, entityId)
    if (patch.status !== undefined && !c.statusValues.includes(patch.status)) {
      throw new StoreError(422, `状态仅支持 ${c.statusValues.join(' / ')}`)
    }
    const sets: string[] = ['updated_at = ?']
    const values: SQLInputValue[] = [now()]
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new StoreError(422, '名称不能为空')
      sets.push('name = ?')
      values.push(patch.name.trim())
    }
    for (const { column, updatable } of c.entityTextColumns) {
      if (updatable !== true || patch.text?.[column] === undefined) continue
      sets.push(`${column} = ?`)
      values.push(patch.text[column]!.trim())
    }
    if (patch.status !== undefined) {
      sets.push('status = ?')
      values.push(patch.status)
    }
    this.db.prepare(
      `UPDATE ${c.entityTable} SET ${sets.join(', ')} WHERE user_id = ? AND ${c.key}_id = ?`,
    ).run(...values, userId, entityId)
    return this.get(userId, entityId)
  }

  // ── 版本链 ────────────────────────────────────────────────────────

  saveVersion(
    userId: string,
    entityId: string,
    input: { code?: string; criteria?: unknown; params?: unknown; change_note?: string; parent_version?: number | null },
  ): Record<string, unknown> {
    const c = this.config
    const entity = this.get(userId, entityId)
    const current = Number(entity.current_version)
    const parent = input.parent_version ?? current
    if (Number(parent) !== current) {
      throw new StoreError(409, `版本冲突：当前版本为 v${current}，提交基于 v${parent}。请先重新读取最新版本再提交修改。`)
    }
    const version = current + 1
    const versionDir = join(this.dir(userId, entityId), 'versions', `v${String(version).padStart(3, '0')}`)
    mkdirSync(versionDir, { recursive: true })

    let digestSha = ''
    let digestBytes = 0
    if (c.version.digest && input.code !== undefined) {
      const codeBytes = Buffer.from(input.code, 'utf-8')
      if (codeBytes.length > 512 * 1024) throw new StoreError(422, `内容超过 ${512 * 1024 / 1024}KB 上限`)
      digestSha = createHash('sha256').update(codeBytes).digest('hex')
      digestBytes = codeBytes.length
      writeFileSync(join(versionDir, c.version.digest.file), codeBytes)
    }
    let contentJson = '{}'
    let contentBytes = 0
    if (c.version.content && input.criteria !== undefined) {
      // Agent 容错：criteria 误传 JSON 字符串（会双重编码）时解一层；
      // 非 JSON 纯文本包成 summary，保证面板时间线可读。
      let criteriaValue: unknown = input.criteria
      if (typeof criteriaValue === 'string') {
        const text = criteriaValue.trim()
        try {
          criteriaValue = JSON.parse(text)
        } catch {
          criteriaValue = { summary: text }
        }
      }
      contentJson = JSON.stringify(criteriaValue)
      contentBytes = Buffer.byteLength(contentJson)
      if (contentBytes > 64 * 1024) throw new StoreError(422, '选股条件超过 64KB 上限')
      writeFileSync(join(versionDir, 'criteria.json'), contentJson, 'utf-8')
    }
    const paramsText = JSON.stringify(input.params ?? {})
    if (Buffer.byteLength(paramsText) > 64 * 1024) throw new StoreError(422, '参数 JSON 超过 64KB 上限')

    const ts = now()
    const digestColumns = c.version.digest ? `, ${c.version.digest.shaColumn}, ${c.version.digest.bytesColumn}` : ''
    const contentColumns = c.version.content ? `, ${c.version.content.jsonColumn}, ${c.version.content.bytesColumn}` : ''
    this.db.prepare(
      `INSERT INTO ${c.versionTable} (user_id, ${c.key}_id, version, parent_version${digestColumns}${contentColumns}, params_json, change_note, created_at)
       VALUES (?, ?, ?, ?${c.version.digest ? ', ?, ?' : ''}${c.version.content ? ', ?, ?' : ''}, ?, ?, ?)`,
    ).run(
      userId, entityId, version, current,
      ...(c.version.digest ? [digestSha, digestBytes] : []),
      ...(c.version.content ? [contentJson, contentBytes] : []),
      paramsText, (input.change_note ?? '').trim(), ts,
    )
    this.db.prepare(
      `UPDATE ${c.entityTable} SET current_version = ?, updated_at = ? WHERE user_id = ? AND ${c.key}_id = ?`,
    ).run(version, ts, userId, entityId)
    return { [`${c.key}_id`]: entityId, version, parent_version: current, code_sha256: digestSha || undefined, created_at: ts }
  }

  listVersions(userId: string, entityId: string): Record<string, unknown>[] {
    this.get(userId, entityId)
    const rows = this.db.prepare(
      `SELECT * FROM ${this.config.versionTable} WHERE user_id = ? AND ${this.config.key}_id = ? ORDER BY version`,
    ).all(userId, entityId) as Record<string, unknown>[]
    return rows.map(unpackJsonColumns)
  }

  getVersion(userId: string, entityId: string, version: number): Record<string, unknown> {
    const c = this.config
    const row = this.db.prepare(
      `SELECT * FROM ${c.versionTable} WHERE user_id = ? AND ${c.key}_id = ? AND version = ?`,
    ).get(userId, entityId, version) as Record<string, unknown> | undefined
    if (row === undefined) throw new StoreError(404, `版本不存在：${entityId} v${version}`)
    const item = unpackJsonColumns(row)
    if (c.version.digest) {
      const codePath = join(this.dir(userId, entityId), 'versions', `v${String(version).padStart(3, '0')}`, c.version.digest.file)
      item.code = readFileSync(codePath, 'utf-8')
      item.code_path = codePath
    }
    return item
  }

  // ── 运行记录 ──────────────────────────────────────────────────────

  recordRun(userId: string, entityId: string, body: Record<string, unknown>): Record<string, unknown> {
    const c = this.config
    const entity = this.get(userId, entityId)
    const version = Number(body.version)
    const current = Number(entity.current_version)
    if (version < 1 || version > current) {
      throw new StoreError(422, `版本越界：v${version}（当前最新 v${current}）`)
    }
    const textValues = (c.runTextColumns ?? []).map(column => String(body[column] ?? ''))
    const jsonValues = c.runJsonColumns.map(({ column, bodyKey }) => {
      const text = JSON.stringify(body[bodyKey] ?? {})
      if (Buffer.byteLength(text) > 4 * 1024 * 1024) throw new StoreError(422, `${column} 超过 4MB 上限`)
      return [column, text] as const
    })

    const runId = shortRandom(c.runIdPrefix)
    const runDir = join(this.dir(userId, entityId), 'runs', runId)
    mkdirSync(runDir, { recursive: true })

    const attachmentPaths = c.runAttachments.map((attachment) => {
      const payload = body[attachment.key]
      if (payload === undefined || payload === null) return [attachment.pathColumn, null] as const
      const text = attachment.text ? String(payload) : JSON.stringify(payload)
      if (Buffer.byteLength(text) > attachment.limit) throw new StoreError(422, `${attachment.key} 超过 ${Math.round(attachment.limit / 1024 / 1024 * 10) / 10}MB 上限`)
      writeFileSync(join(runDir, attachment.file), text, 'utf-8')
      return [attachment.pathColumn, join(runDir, attachment.file).slice(this.libraryRoot.length + 1)] as const
    })

    const ts = now()
    const attachmentColumns = c.runAttachments.map(({ pathColumn }) => pathColumn)
    this.db.prepare(
      `INSERT INTO ${c.runsTable} (user_id, run_id, ${c.key}_id, version, ${(c.runTextColumns ?? []).join(', ')}${(c.runTextColumns ?? []).length ? ', ' : ''}${c.runJsonColumns.map(({ column }) => column).join(', ')}, ${attachmentColumns.join(', ')}, thread_id, created_at)
       VALUES (?, ?, ?, ?, ${(c.runTextColumns ?? []).map(() => '?').join(', ')}${(c.runTextColumns ?? []).length ? ', ' : ''}${c.runJsonColumns.map(() => '?').join(', ')}, ${attachmentColumns.map(() => '?').join(', ')}, ?, ?)`,
    ).run(
      userId, runId, entityId, version,
      ...textValues,
      ...jsonValues.map(([, text]) => text),
      ...attachmentPaths.map(([, path]) => path),
      body.thread_id === undefined ? null : String(body.thread_id),
      ts,
    )
    this.db.prepare(
      `UPDATE ${c.entityTable} SET updated_at = ? WHERE user_id = ? AND ${c.key}_id = ?`,
    ).run(ts, userId, entityId)
    return { run_id: runId, [`${c.key}_id`]: entityId, version, created_at: ts }
  }

  listRuns(userId: string, entityId: string, version?: number): Record<string, unknown>[] {
    const c = this.config
    const where = version === undefined ? '' : ` AND version = ?`
    const args = version === undefined ? [userId, entityId] : [userId, entityId, version]
    const rows = this.db.prepare(
      `SELECT * FROM ${c.runsTable} WHERE user_id = ? AND ${c.key}_id = ?${where} ORDER BY created_at DESC`,
    ).all(...args) as Record<string, unknown>[]
    return rows.map(unpackJsonColumns)
  }

  latestRun(userId: string, entityId: string): Record<string, unknown> | null {
    const row = this.db.prepare(
      `SELECT * FROM ${this.config.runsTable} WHERE user_id = ? AND ${this.config.key}_id = ? ORDER BY created_at DESC LIMIT 1`,
    ).get(userId, entityId) as Record<string, unknown> | undefined
    return row === undefined ? null : unpackJsonColumns(row)
  }

  /** 读取某次运行的附件（equity / ic_series / picks / report …）。 */
  getRunAttachment(userId: string, entityId: string, runId: string, key: string): Record<string, unknown> {
    const c = this.config
    const attachment = c.runAttachments.find(item => item.key === key)
    if (attachment === undefined) throw new StoreError(404, `未知附件：${key}`)
    const row = this.db.prepare(
      `SELECT * FROM ${c.runsTable} WHERE user_id = ? AND ${c.key}_id = ? AND run_id = ?`,
    ).get(userId, entityId, runId) as Record<string, unknown> | undefined
    if (row === undefined) throw new StoreError(404, `运行记录不存在：${runId}`)
    if (!row[attachment.pathColumn]) throw new StoreError(422, '该运行未存此附件')
    const raw = readFileSync(join(this.libraryRoot, String(row[attachment.pathColumn])), 'utf-8')
    return {
      run_id: runId,
      version: row.version,
      ...(key === 'equity' ? { data_start: row.data_start, data_end: row.data_end } : {}),
      [key]: attachment.text ? raw : JSON.parse(raw),
    }
  }

  compareRuns(userId: string, entityId: string, runIds: string[]): Record<string, unknown> {
    const c = this.config
    const rows = runIds.map((runId) => {
      const row = this.db.prepare(
        `SELECT * FROM ${c.runsTable} WHERE user_id = ? AND ${c.key}_id = ? AND run_id = ?`,
      ).get(userId, entityId, runId) as Record<string, unknown> | undefined
      if (row === undefined) throw new StoreError(404, `运行记录不存在：${runId}`)
      return unpackJsonColumns(row)
    })
    const ranges = new Set(rows.map(r => `${r[Object.hasOwn(r, 'trade_date') ? 'trade_date' : 'data_start']}~${r.data_end}`))
    const rulesSet = new Set(rows.map(r => JSON.stringify(r.rules)))
    const comparable = ranges.size === 1 && rulesSet.size === 1
    return {
      [`${c.key}_id`]: entityId,
      runs: rows,
      comparable,
      notes: comparable ? [] : [
        '所选运行的数据区间或规则配置不一致，对比仅供粗略参考；严格对比应使用相同数据区间与相同规则配置的运行。',
      ],
    }
  }
}

/** 行 → 响应：`*_json` 列反序列化并剥掉后缀（`rules_json` → `rules`，对齐 1.x API 契约）。 */
function unpackJsonColumns(row: Record<string, unknown>): Record<string, unknown> {
  const item: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (key.endsWith('_json')) {
      item[key.slice(0, -5)] = JSON.parse(String(value))
    } else {
      item[key] = value
    }
  }
  return item
}

// ── 三库配置（对照 1.x schema，表名/列名逐字兼容）────────────────────────

export function strategyStore(dataRoot: string): LibraryStore {
  return new LibraryStore({
    key: 'strategy',
    idPrefix: 'stg_',
    runIdPrefix: 'srun_',
    entityTable: 'strategies',
    versionTable: 'strategy_versions',
    runsTable: 'backtest_runs',
    statusValues: ['researching', 'paused', 'rejected'],
    defaultStatus: 'researching',
    entityTextColumns: [{ column: 'hypothesis', defaultValue: '', updatable: true }],
    version: { digest: { shaColumn: 'code_sha256', bytesColumn: 'code_bytes', file: 'signal_engine.py' } },
    runTextColumns: ['data_start', 'data_end'],
    runJsonColumns: [{ column: 'rules_json', bodyKey: 'rules' }, { column: 'metrics_json', bodyKey: 'metrics' }],
    runAttachments: [
      { key: 'equity', pathColumn: 'equity_path', file: 'equity.json', limit: 2 * 1024 * 1024 },
      { key: 'trades', pathColumn: 'trades_path', file: 'trades.json', limit: 4 * 1024 * 1024 },
    ],
  }, dataRoot)
}

export function factorStore(dataRoot: string): LibraryStore {
  return new LibraryStore({
    key: 'factor',
    idPrefix: 'fac_',
    runIdPrefix: 'frun_',
    entityTable: 'factors',
    versionTable: 'factor_versions',
    runsTable: 'factor_runs',
    statusValues: ['researching', 'paused', 'rejected'],
    defaultStatus: 'researching',
    entityTextColumns: [
      { column: 'hypothesis', defaultValue: '', updatable: true },
      { column: 'category', defaultValue: 'custom' },
    ],
    version: { digest: { shaColumn: 'code_sha256', bytesColumn: 'code_bytes', file: 'factor_engine.py' } },
    runTextColumns: ['universe'],
    runJsonColumns: [{ column: 'config_json', bodyKey: 'config' }, { column: 'metrics_json', bodyKey: 'metrics' }],
    runAttachments: [
      { key: 'ic_series', pathColumn: 'ic_series_path', file: 'ic_series.json', limit: 2 * 1024 * 1024 },
      { key: 'layers', pathColumn: 'layers_path', file: 'layers.json', limit: 2 * 1024 * 1024 },
    ],
  }, dataRoot)
}

export function selectionStore(dataRoot: string): LibraryStore {
  return new LibraryStore({
    key: 'selection',
    idPrefix: 'sel_',
    runIdPrefix: 'selrun_',
    entityTable: 'selections',
    versionTable: 'selection_versions',
    runsTable: 'selection_runs',
    statusValues: ['watching', 'paused', 'rejected'],
    defaultStatus: 'watching',
    entityTextColumns: [{ column: 'criteria', defaultValue: '', updatable: true }],
    version: { content: { jsonColumn: 'criteria_json', bytesColumn: 'criteria_bytes', payloadKey: 'criteria' } },
    runTextColumns: ['trade_date', 'universe'],
    runJsonColumns: [{ column: 'rules_json', bodyKey: 'rules' }, { column: 'metrics_json', bodyKey: 'metrics' }],
    runAttachments: [
      { key: 'report', pathColumn: 'report_path', file: 'report.md', limit: 2 * 1024 * 1024, text: true },
      { key: 'picks', pathColumn: 'picks_path', file: 'picks.json', limit: 4 * 1024 * 1024 },
    ],
  }, dataRoot)
}
