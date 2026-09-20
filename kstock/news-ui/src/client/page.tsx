/**
 * 财经新闻 主区面板：实时快讯列表（落地页 landing-news 的 workspace 形态）。
 *
 * - 数据：`GET /kstock-api/workspace-news`（服务端 60 秒缓存，主源东方财富
 *   + 备源央视）；客户端每 60 秒自动刷新 + 手动刷新；
 * - 外链 target=_blank：Electron 壳转交系统浏览器，浏览器直连开新标签；
 * - 无数据诚实空态（数据源不可用时不编造，与全产品口径一致）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Empty, ErrorLine, Loading, RefreshButton, formatDateTime } from '@kstock/quant-ui'

interface NewsItem {
  title: string
  source: string
  published_at: string
  url: string
  summary: string
}

interface NewsPayload {
  items: NewsItem[]
  updated_at: string
}

/** 与服务端缓存 TTL 对齐的自动刷新间隔。 */
const REFRESH_MS = 60_000

export function NewsPage() {
  const [payload, setPayload] = useState<NewsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/kstock-api/workspace-news')
      if (!response.ok) throw new Error(`请求失败（${response.status}）`)
      const data = (await response.json()) as NewsPayload
      if (!alive.current) return
      setPayload(data)
      setError(null)
    } catch (err) {
      if (!alive.current) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    return () => {
      alive.current = false
      window.clearInterval(timer)
    }
  }, [load])

  const items = payload?.items ?? []

  return (
    <div className="ksq-page">
      <header className="ksq-topbar">
        <div className="ksq-title">
          <strong>财经新闻</strong>
          <span>实时快讯 · 每 60 秒自动刷新{payload ? ` · 更新于 ${formatDateTime(payload.updated_at)}` : ''}</span>
        </div>
        <div className="ksq-topbar-actions">
          <span className="ksq-count">{items.length} 条</span>
          <RefreshButton refreshing={loading} onClick={() => void load()} label="刷新" />
        </div>
      </header>

      {error !== null && <ErrorLine message={error} />}
      {loading && payload === null && error === null && <Loading text="加载财经快讯…" />}

      {!loading && payload !== null && items.length === 0 && error === null && (
        <Empty
          icon="📰"
          title="暂无快讯"
          hint="数据源（东方财富/央视）暂未返回内容——网络不可用或接口限流，稍后自动重试"
        />
      )}

      {items.length > 0 && (
        <div className="ksq-news-list">
          {items.map((item, index) => (
            <article key={`${item.title}-${index}`} className="ksq-news-item">
              <div className="ksq-news-meta">
                <span className="ksq-news-source">{item.source}</span>
                <time>{item.published_at}</time>
              </div>
              {item.url !== '' ? (
                <a className="ksq-news-title" href={item.url} target="_blank" rel="noreferrer noopener">
                  {item.title}
                </a>
              ) : (
                <span className="ksq-news-title">{item.title}</span>
              )}
              {item.summary !== '' && <p className="ksq-news-summary">{item.summary}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
