/**
 * 财经新闻档案库（sqlite 滚动留存 + 检索 + 热词/频率统计）。
 *
 * live feed 只有 60 秒缓存、刷新即失——本库把每次刷新见到的条目
 * INSERT OR IGNORE 进 `~/.kstock/news.db`（按标题去重），支撑：
 * - 历史检索（「早上那条关于 XX 的新闻」）；
 * - 热词榜（近 N 小时标题的字典词频）；
 * - 快讯频率（按小时桶计数，新闻密度作为市场情绪代理）。
 * 独立 db 文件，与 product/kstock.db（1.x 兼容库）互不干扰。
 * @module @kstock/quant/news-store
 */

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/** 与 news.ts 的 LandingNewsItem 保持结构一致（stocks 为识别标注）。 */
export interface ArchiveItem {
  title: string
  source: string
  published_at: string
  url: string
  summary: string
  stocks?: Array<{ code: string; name: string; industry?: string }>
}

export interface ArchiveHit extends ArchiveItem {
  archived_at: string
}

export class NewsStore {
  private readonly db: DatabaseSync

  constructor(dataRoot: string) {
    this.db = new DatabaseSync(join(dataRoot, 'news.db'))
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL,
        published_at TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        stocks TEXT NOT NULL DEFAULT '[]',
        archived_at INTEGER NOT NULL
      )
    `)
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_news_archived ON news(archived_at)')
  }

  /** 留档一批条目（标题去重幂等）；返回新插入条数。 */
  archive(items: ArchiveItem[]): number {
    if (items.length === 0) return 0
    const statement = this.db.prepare(
      'INSERT OR IGNORE INTO news (title, source, published_at, url, summary, stocks, archived_at) '
      + 'VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    let inserted = 0
    const now = Date.now()
    this.db.exec('BEGIN')
    try {
      for (const item of items) {
        const result = statement.run(
          item.title,
          item.source,
          item.published_at,
          item.url,
          item.summary,
          JSON.stringify(item.stocks ?? []),
          now,
        )
        inserted += Number(result.changes)
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
    return inserted
  }

  /** 历史检索：时间窗内 LIKE 匹配（标题+摘要），新在前。 */
  search(query: string, hours: number, limit: number): ArchiveHit[] {
    const since = Date.now() - hours * 3_600_000
    const pattern = `%${query.replace(/[%_]/g, ' $&')}%`
    const rows = this.db
      .prepare(
        'SELECT title, source, published_at, url, summary, stocks, archived_at FROM news '
          + 'WHERE archived_at >= ? AND (title LIKE ? ESCAPE \' \' OR summary LIKE ? ESCAPE \' \') '
          + 'ORDER BY archived_at DESC LIMIT ?',
      )
      .all(since, pattern, pattern, limit) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      title: String(row.title),
      source: String(row.source),
      published_at: String(row.published_at),
      url: String(row.url),
      summary: String(row.summary),
      stocks: JSON.parse(String(row.stocks)) as ArchiveItem['stocks'],
      archived_at: new Date(Number(row.archived_at)).toISOString(),
    }))
  }

  /** 热词榜：时间窗内标题对字典词的命中计数（确定性字典匹配）。 */
  trending(spanMs: number, limit: number, dictionary: readonly string[]): Array<{ word: string; count: number }> {
    const since = Date.now() - spanMs
    const rows = this.db
      .prepare('SELECT title FROM news WHERE archived_at >= ?')
      .all(since) as Array<{ title: string }>
    const counts = new Map<string, number>()
    for (const word of dictionary) {
      let count = 0
      for (const row of rows) {
        if (row.title.includes(word)) count += 1
      }
      if (count > 0) counts.set(word, count)
    }
    return [...counts.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, limit)
  }

  /** 频率分布：span 按 bucket 分桶计数（时间桶起点毫秒，旧→新）。 */
  frequency(spanMs: number, bucketMs: number): Array<{ bucket: number; count: number }> {
    const now = Date.now()
    const since = now - spanMs
    const rows = this.db
      .prepare('SELECT archived_at FROM news WHERE archived_at >= ?')
      .all(since) as Array<{ archived_at: number }>
    const buckets = Math.max(1, Math.ceil(spanMs / bucketMs))
    const counts = new Array<number>(buckets).fill(0)
    for (const row of rows) {
      const index = Math.min(buckets - 1, Math.max(0, Math.floor((Number(row.archived_at) - since) / bucketMs)))
      counts[index]! += 1
    }
    return counts.map((count, index) => ({ bucket: since + index * bucketMs, count }))
  }
}
