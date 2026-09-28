/**
 * 报告库存储：自包含 HTML 研究报告的归档与索引。
 *
 * 从 1.x `scripts/kstock_reports.py` 忠实移植：表结构（report_library +
 * report_deletions）、文件布局（reports/{user}/{Y}/{M}/{D}/{report_id}.html）、
 * sha256 内容寻址与删除标记语义保持不变。与三库不同，报告无版本链——
 * 同 report_id 重复入库即覆盖更新。1.x 的线程 outputs 被动扫描归档依赖
 * 2.x 引擎的目录布局（QILIN_HOME/users/...），3.x 已不适用，归档入口
 * 收敛为 agent 显式调用（POST /kstock-api/reports）。
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { type SQLInputValue, DatabaseSync } from 'node:sqlite'
import { StoreError } from './store.ts'

/** 1.x 同款路径组件白名单：防报告 id / user id 拼进文件路径。 */
const SAFE_COMPONENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

/** 单份报告 HTML 的大小上限。 */
const MAX_REPORT_BYTES = 8 * 1024 * 1024

export interface ReportArchiveInput {
  threadId: string
  reportId?: string
  title?: string
  symbol?: string | null
  reportType?: string
  generatedAt?: string
  periodStart?: string | null
  periodEnd?: string | null
  riskLevel?: string | null
  coverageStatus?: string | null
  /** 报告 HTML 全文（UTF-8）。 */
  content: string
}

export class ReportsStore {
  private readonly db: DatabaseSync
  private readonly dataRoot: string
  readonly reportsRoot: string

  constructor(dataRoot: string) {
    this.dataRoot = resolve(dataRoot)
    this.reportsRoot = join(this.dataRoot, 'reports')
    mkdirSync(this.reportsRoot, { recursive: true })
    this.db = new DatabaseSync(join(this.dataRoot, 'product', 'kstock.db'))
    this.db.exec('PRAGMA journal_mode = WAL')
    this.initialize()
  }

  /** 释放 SQLite 句柄：删除临时库（Windows 文件锁）前必须先关。 */
  close(): void {
    this.db.close()
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS report_library (
        report_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        title TEXT NOT NULL,
        symbol TEXT,
        report_type TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        period_start TEXT,
        period_end TEXT,
        risk_level TEXT,
        coverage_status TEXT,
        relative_path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, report_id)
      );
      CREATE INDEX IF NOT EXISTS idx_report_library_date ON report_library (user_id, generated_at);
      CREATE TABLE IF NOT EXISTS report_deletions (
        user_id TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        deleted_at TEXT NOT NULL,
        PRIMARY KEY (user_id, sha256)
      );
    `)
  }

  list(userId: string, filter: { date?: string; symbol?: string; query?: string } = {}): Record<string, unknown>[] {
    component(userId, 'user_id')
    const clauses = ['user_id = ?']
    const values: SQLInputValue[] = [userId]
    if (filter.date) {
      clauses.push('substr(generated_at, 1, 10) = ?')
      values.push(filter.date)
    }
    if (filter.symbol) {
      clauses.push('symbol = ?')
      values.push(filter.symbol)
    }
    if (filter.query) {
      clauses.push('(title LIKE ? OR report_type LIKE ? OR symbol LIKE ?)')
      const pattern = `%${filter.query}%`
      values.push(pattern, pattern, pattern)
    }
    return this.db.prepare(
      `SELECT * FROM report_library WHERE ${clauses.join(' AND ')} ORDER BY generated_at DESC`,
    ).all(...values) as Record<string, unknown>[]
  }

  /** 不存在返回 null（路由层负责 404 文案）。 */
  find(userId: string, reportId: string): Record<string, unknown> | null {
    return this.db.prepare(
      'SELECT * FROM report_library WHERE user_id = ? AND report_id = ?',
    ).get(component(userId, 'user_id'), component(reportId, 'report_id')) as Record<string, unknown> | null ?? null
  }

  /**
   * 归档（或覆盖更新）一份报告：内容落盘 + upsert 索引行。
   * report_id 缺省时由 thread_id + title 稳定派生——同线程同主题重跑
   * 天然走覆盖更新，与 1.x「report_id 由文件名 stem 派生」的语义对齐。
   */
  archive(userId: string, input: ReportArchiveInput): Record<string, unknown> {
    const user = component(userId, 'user_id')
    const threadId = component(input.threadId, 'thread_id')
    const content = input.content ?? ''
    if (!content.trim()) throw new StoreError(422, '报告内容（content）不能为空')
    const generatedAt = input.generatedAt ?? now()
    const [year, month, day] = generatedDate(generatedAt)
    const reportId = component(
      input.reportId ?? `report-${createHash('sha256').update(`${threadId}:${input.title ?? ''}`).digest('hex').slice(0, 12)}`,
      'report_id',
    )
    const relativePath = ['reports', user, year, month, day, `${reportId}.html`].join('/')
    const bytes = Buffer.from(content, 'utf-8')
    if (bytes.length > MAX_REPORT_BYTES) throw new StoreError(422, `报告内容超过 ${MAX_REPORT_BYTES / 1024 / 1024}MB 上限`)
    const digest = createHash('sha256').update(bytes).digest('hex')

    const existing = this.find(user, reportId)
    const ts = now()
    const row: Record<string, SQLInputValue> = {
      report_id: reportId,
      user_id: user,
      thread_id: threadId,
      title: input.title?.trim() || reportId,
      symbol: input.symbol ?? null,
      report_type: input.reportType?.trim() || 'analysis',
      generated_at: generatedAt,
      period_start: input.periodStart ?? null,
      period_end: input.periodEnd ?? null,
      risk_level: input.riskLevel ?? null,
      coverage_status: input.coverageStatus ?? null,
      relative_path: relativePath,
      size_bytes: bytes.length,
      sha256: digest,
      created_at: existing ? String(existing.created_at) : ts,
      updated_at: ts,
    }

    const target = join(this.dataRoot, relativePath)
    mkdirSync(join(target, '..'), { recursive: true })
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`
    writeFileSync(tmp, bytes)
    renameSync(tmp, target)
    this.db.prepare(`
      INSERT INTO report_library
        (report_id,user_id,thread_id,title,symbol,report_type,generated_at,period_start,period_end,
         risk_level,coverage_status,relative_path,size_bytes,sha256,created_at,updated_at)
      VALUES ($report_id,$user_id,$thread_id,$title,$symbol,$report_type,$generated_at,$period_start,$period_end,
              $risk_level,$coverage_status,$relative_path,$size_bytes,$sha256,$created_at,$updated_at)
      ON CONFLICT(user_id, report_id) DO UPDATE SET
        thread_id=$thread_id,title=$title,symbol=$symbol,report_type=$report_type,generated_at=$generated_at,
        period_start=$period_start,period_end=$period_end,risk_level=$risk_level,coverage_status=$coverage_status,
        relative_path=$relative_path,size_bytes=$size_bytes,sha256=$sha256,updated_at=$updated_at
    `).run(row)
    // 覆盖更新落在了新日期目录时，清掉旧路径的文件。
    if (existing && existing.relative_path !== relativePath) {
      rmSync(join(this.dataRoot, String(existing.relative_path)), { force: true })
    }
    return { ...row, content_url: `/kstock-api/reports/${reportId}/content` }
  }

  /** 报告 HTML 的磁盘路径；越界或文件缺失一律按不存在处理。 */
  contentPath(userId: string, reportId: string): string {
    const row = this.find(userId, reportId)
    if (row === null) throw new StoreError(404, '报告不存在')
    const path = resolve(this.dataRoot, String(row.relative_path))
    if (!path.startsWith(resolve(this.reportsRoot) + sep) || !existsSync(path)) {
      throw new StoreError(404, '报告不存在')
    }
    return path
  }

  readContent(userId: string, reportId: string): Buffer {
    return readFileSync(this.contentPath(userId, reportId))
  }

  delete(userId: string, reportId: string): void {
    const row = this.find(userId, reportId)
    if (row === null) throw new StoreError(404, '报告不存在')
    const path = resolve(this.dataRoot, String(row.relative_path))
    if (!path.startsWith(resolve(this.reportsRoot) + sep)) {
      throw new StoreError(422, '报告路径越界，拒绝删除')
    }
    this.db.prepare(
      'INSERT OR REPLACE INTO report_deletions (user_id, sha256, deleted_at) VALUES (?, ?, ?)',
    ).run(component(userId, 'user_id'), String(row.sha256), now())
    this.db.prepare(
      'DELETE FROM report_library WHERE user_id = ? AND report_id = ?',
    ).run(userId, reportId)
    rmSync(path, { force: true })
  }
}

function component(value: unknown, name: string): string {
  const text = String(value ?? '')
  if (!SAFE_COMPONENT.test(text)) throw new StoreError(422, `${name} 含不安全的路径字符`)
  return text
}

/** ISO 时间戳 → 报告归档目录的年/月/日段。 */
function generatedDate(value: string): [string, string, string] {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new StoreError(422, 'generated_at 必须是 ISO-8601 时间戳')
  const pad = (n: number) => String(n).padStart(2, '0')
  return [String(parsed.getFullYear()), pad(parsed.getMonth() + 1), pad(parsed.getDate())]
}

function now(): string {
  return new Date().toISOString()
}
