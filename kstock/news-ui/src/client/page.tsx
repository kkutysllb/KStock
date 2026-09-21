/**
 * 财经新闻 主区面板 2.0：实时流 + 标的联动 + 关注雷达 + 已读 + 统计。
 *
 * - 实时流：`GET /kstock-api/workspace-news`（60s 服务端缓存 + 客户端
 *   60s 自动刷新 + 手动刷新）；条目带标的识别徽章（服务端字典匹配）；
 * - 标的联动 / 「让 Agent 解读」：经 bindAgentBridge 注入的
 *   conversation.send() 把提示词送进当前会话并切回对话页；
 * - 关注雷达：localStorage 关注词表，命中高亮 + 「只看命中」过滤；
 * - 已读/未读：localStorage 已读标题哈希集（上限 300），已读淡化，
 *   未读计数展示；
 * - 统计侧栏：热词榜（6h 字典词频，点击即检索）+ 24h 逐小时频率条；
 * - 检索：输入 ≥2 字切「历史模式」查 news-archive 留档库（含已滚出的
 *   旧闻），清空回实时流。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Empty, ErrorLine, Loading, RefreshButton, TaskTargetMenu, formatDateTime, type UseWorkspaces } from '@kstock/quant-ui'

interface StockTag {
  code: string
  name: string
  industry?: string
}

interface NewsItem {
  title: string
  source: string
  published_at: string
  url: string
  summary: string
  stocks?: StockTag[]
}

interface NewsPayload {
  items: NewsItem[]
  updated_at: string
}

interface ArchiveResult {
  items: Array<NewsItem & { archived_at: string }>
}

interface StatsPayload {
  themes: Array<{ word: string; count: number }>
  stocks: Array<{ word: string; count: number }>
  frequency: Array<{ bucket: number; count: number }>
  dictionary_size: number
}

/** 与服务端缓存 TTL 对齐的自动刷新间隔。 */
const REFRESH_MS = 60_000

const WATCH_KEY = 'kstock-news-watch'
const READ_KEY = 'kstock-news-read'
const READ_CAP = 300

/** agent 桥（apply 时注入 §26-10 目标路由 + 原生目录选择 + 面板切换）。 */
let agentBridge: import('@kstock/quant-ui').TaskRouterBridge | null = null

export function bindAgentBridge(bridge: import('@kstock/quant-ui').TaskRouterBridge): void {
  agentBridge = bridge
}

/**
 * 内嵌浏览器打开回调（apply 时注入 ctx.sidebarRight.openTab('browser')）。
 * 未注入（sidebarRight 服务缺席）时保持 null —— 标题链接退回原生行为
 * （新标签 → 壳转系统浏览器），不阻断阅读。
 */
let embeddedBrowserOpen: ((url: string) => void) | null = null

export function bindEmbeddedBrowser(open: ((url: string) => void) | null): void {
  embeddedBrowserOpen = open
}

/** 稳定字符串哈希（已读集键，djb2）。 */
function hash(text: string): string {
  let value = 5381
  for (let index = 0; index < text.length; index += 1) {
    value = ((value << 5) + value + text.charCodeAt(index)) >>> 0
  }
  return value.toString(36)
}

function loadWatchWords(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(WATCH_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((word): word is string => typeof word === 'string' && word !== '') : []
  } catch {
    return []
  }
}

function loadReadSet(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as unknown
    return new Set(Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set()
  }
}

function saveReadSet(set: Set<string>): void {
  const list = [...set].slice(-READ_CAP)
  localStorage.setItem(READ_KEY, JSON.stringify(list))
}

/** 展示时间：可解析的「YYYY-MM-DD HH:mm[:ss]」转相对时间，否则原样。 */
function displayTime(raw: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(raw)
  if (match === null) return raw
  const timestamp = new Date(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]),
  ).getTime()
  if (Number.isNaN(timestamp)) return raw
  const diff = Date.now() - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return raw.slice(5, 16)
}

/** 标的快析提示词（徽章点击）。 */
function stockPrompt(tag: StockTag): string {
  return `对 ${tag.name}（${tag.code}）做快速分析：公司基本面要点 + 当前估值水平（含近一年历史分位）+ 近期催化与风险，最后一句话结论。`
    + '当前会话若未挂载 stock-analysis/估值引擎技能，用网页检索补充并标注数据来源；禁止编造数值。'
}

/** 新闻解读提示词（解读按钮）。 */
function interpretPrompt(item: NewsItem): string {
  const summary = item.summary !== '' ? `——${item.summary}` : ''
  const related = (item.stocks ?? []).map((tag) => `${tag.name}(${tag.code})`).join('、')
  return `请解读这条财经快讯的市场影响：【${item.source} ${item.published_at}】${item.title}${summary}。`
    + (related !== '' ? `标题涉及标的：${related}。` : '')
    + '要求：1) 检索交叉验证——当前会话挂载了 news-search 技能就优先用它；'
    + '未挂载（如标准预设会话）改用网页检索工具；两者都不可用则基于新闻原文分析并明确标注「未交叉验证」，'
    + '禁止反复尝试不存在的技能名；2) 分析受益/受损方向与相关 A 股标的；'
    + '3) 给出关注信号与反证信号；数据缺失诚实标注「无数据」，不构成投资建议。'
}

export function NewsPage({ useWorkspaces }: { useWorkspaces?: UseWorkspaces } = {}) {
  const [payload, setPayload] = useState<NewsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [archive, setArchive] = useState<ArchiveResult | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [watchRaw, setWatchRaw] = useState(() => loadWatchWords().join(' '))
  const [watchEditing, setWatchEditing] = useState(false)
  const [onlyWatch, setOnlyWatch] = useState(false)
  const [readSet, setReadSet] = useState(() => loadReadSet())
  const [stats, setStats] = useState<StatsPayload | null>(null)
  const alive = useRef(true)

  const watchWords = useMemo(
    () => watchRaw.split(/[\s,，、;；]+/).filter((word) => word !== ''),
    [watchRaw],
  )

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

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch('/kstock-api/news-stats')
      if (!response.ok) return
      const data = (await response.json()) as StatsPayload
      if (alive.current) setStats(data)
    } catch {
      // 统计侧栏非关键路径，失败静默。
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    void loadStats()
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    const statsTimer = window.setInterval(() => void loadStats(), 5 * REFRESH_MS)
    return () => {
      alive.current = false
      window.clearInterval(timer)
      window.clearInterval(statsTimer)
    }
  }, [load, loadStats])

  // 检索：≥2 字进历史模式（查留档库），清空回实时流。
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setArchive(null)
      return
    }
    setArchiveLoading(true)
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/kstock-api/news-archive?q=${encodeURIComponent(trimmed)}&hours=168&limit=50`)
          if (!response.ok) return
          const data = (await response.json()) as ArchiveResult
          if (alive.current) setArchive(data)
        } catch {
          // 检索失败保持实时流。
        } finally {
          if (alive.current) setArchiveLoading(false)
        }
      })()
    }, 300)
    return () => window.clearTimeout(handle)
  }, [query])

  const markRead = useCallback((title: string) => {
    setReadSet((previous) => {
      const next = new Set(previous)
      next.add(hash(title))
      saveReadSet(next)
      return next
    })
  }, [])

  // §26-10：解读/标的点击先弹目标选择菜单（按 news 类型记忆上次落点）。
  const [pendingAsk, setPendingAsk] = useState<string | null>(null)
  const askAgent = useCallback((prompt: string) => {
    if (agentBridge === null) {
      console.error('[kstock-news] bridge missing')
      return
    }
    setPendingAsk(prompt)
  }, [])

  const items = payload?.items ?? []

  const hitWatch = useCallback((item: NewsItem): boolean => {
    if (watchWords.length === 0) return false
    const text = `${item.title} ${item.summary}`
    return watchWords.some((word) => text.includes(word))
  }, [watchWords])

  const visibleItems = onlyWatch ? items.filter(hitWatch) : items
  const unreadCount = items.filter((item) => !readSet.has(hash(item.title))).length

  return (
    <div className="ksq-page">
      <header className="ksq-topbar">
        <div className="ksq-title">
          <strong>财经新闻</strong>
          <span>
            实时快讯 · 每 60 秒自动刷新
            {payload ? ` · 更新于 ${formatDateTime(payload.updated_at)}` : ''}
            {unreadCount > 0 ? ` · 未读 ${unreadCount}` : ''}
          </span>
        </div>
        <div className="ksq-topbar-actions">
          <span className="ksq-count">{archive !== null ? `${archive.items.length} 条命中` : `${items.length} 条`}</span>
          <RefreshButton refreshing={loading} onClick={() => { void load(); void loadStats() }} label="刷新" />
        </div>
      </header>

      <div className="ksq-news-toolbar">
        <div className="ksq-tabs">
          <button
            type="button"
            className={`ksq-tab ${onlyWatch ? '' : 'active'}`}
            onClick={() => setOnlyWatch(false)}
          >
            全部
          </button>
          <button
            type="button"
            className={`ksq-tab ${onlyWatch ? 'active' : ''}`}
            onClick={() => setOnlyWatch(true)}
            disabled={watchWords.length === 0}
            title={watchWords.length === 0 ? '先配置关注词' : undefined}
          >
            关注命中 {watchWords.length > 0 ? `(${watchWords.length})` : ''}
          </button>
        </div>
        <div className="ksq-news-toolbar-right">
          <button type="button" className="ksq-linkbtn" onClick={() => setWatchEditing((value) => !value)}>
            关注词
          </button>
          <div className="ksq-search">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={query.trim().length >= 2 ? '历史检索中（近 7 天）…' : '搜索标题 / 摘要 / 标的（≥2 字查历史）'}
            />
          </div>
        </div>
      </div>

      {watchEditing && (
        <div className="ksq-news-watchedit">
          <input
            value={watchRaw}
            onChange={(event) => {
              setWatchRaw(event.target.value)
              localStorage.setItem(WATCH_KEY, JSON.stringify(
                event.target.value.split(/[\s,，、;；]+/).filter((word) => word !== ''),
              ))
            }}
            placeholder="关注词，空格或逗号分隔（如：锂矿 美联储 宁德时代）——命中的新闻会高亮"
            autoFocus
          />
        </div>
      )}

      <div className="ksq-body ksq-news-split">
        <div className="ksq-news-main">
          {error !== null && <ErrorLine message={error} />}
          {loading && payload === null && error === null && <Loading text="加载财经快讯…" />}
          {archiveLoading && <Loading text="检索历史留档…" />}

          {!loading && payload !== null && items.length === 0 && error === null && (
            <Empty
              icon="📰"
              title="暂无快讯"
              hint="数据源（东方财富/央视）暂未返回内容——网络不可用或接口限流，稍后自动重试"
            />
          )}
          {onlyWatch && visibleItems.length === 0 && items.length > 0 && (
            <Empty icon="🎯" title="暂无关注命中" hint={`当前 ${watchWords.length} 个关注词在最近快讯中未命中`} />
          )}

          {archive !== null && (
            <div className="ksq-news-list">
              {archive.items.map((item, index) => (
                <NewsCard
                  key={`a-${item.title}-${index}`}
                  item={item}
                  watched={hitWatch(item)}
                  read
                  onRead={markRead}
                  onAsk={askAgent}
                  archived
                />
              ))}
              {archive.items.length === 0 && !archiveLoading && (
                <Empty icon="🔍" title="历史无命中" hint="近 7 天留档中没有匹配「此关键词」的新闻" />
              )}
            </div>
          )}

          {archive === null && visibleItems.length > 0 && (
            <div className="ksq-news-list">
              {visibleItems.map((item, index) => (
                <NewsCard
                  key={`${item.title}-${index}`}
                  item={item}
                  watched={hitWatch(item)}
                  read={readSet.has(hash(item.title))}
                  onRead={markRead}
                  onAsk={askAgent}
                />
              ))}
            </div>
          )}
        </div>

        <StatsAside stats={stats} onPickWord={(word) => setQuery(word)} />
      </div>

      {pendingAsk !== null && agentBridge !== null && (
        <TaskTargetMenu
          taskKind="news"
          title="新闻解读发送到…"
          prompt={pendingAsk}
          bridge={agentBridge}
          useWorkspaces={useWorkspaces}
          onClose={() => setPendingAsk(null)}
        />
      )}
    </div>
  )
}

function NewsCard({ item, watched, read, onRead, onAsk, archived = false }: {
  item: NewsItem
  watched: boolean
  read: boolean
  onRead: (title: string) => void
  onAsk: (prompt: string) => void
  archived?: boolean
}): React.ReactElement {
  return (
    <article
      className={`ksq-news-item${watched ? ' watched' : ''}${read ? ' read' : ''}`}
      onClick={() => onRead(item.title)}
    >
      <div className="ksq-news-meta">
        {watched && <span className="ksq-news-watchflag">关注</span>}
        <span className="ksq-news-source">{item.source}</span>
        <span className="ksq-news-dot" aria-hidden="true" />
        <time className="ksq-news-time" title={item.published_at}>
          {archived ? item.published_at.slice(0, 16) : displayTime(item.published_at)}
        </time>
      </div>
      {item.url !== '' ? (
        <a
          className="ksq-news-title"
          href={item.url}
          target="_blank"
          rel="noreferrer noopener"
          title={embeddedBrowserOpen === null ? undefined : '右栏内嵌浏览器打开（站点拒绝嵌入时可在浏览器标签内转系统浏览器）'}
          onClick={(event) => {
            event.stopPropagation()
            // 左键单击走右栏内嵌浏览器（引擎 3.0.2+ ui-sidebar-browser）；
            // 未接线时保留原生新标签行为；中键/修饰键点击不拦截。
            if (embeddedBrowserOpen === null || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
            event.preventDefault()
            embeddedBrowserOpen(item.url)
          }}
        >
          {item.title}
        </a>
      ) : (
        <span className="ksq-news-title">{item.title}</span>
      )}
      {item.summary !== '' && <p className="ksq-news-summary">{item.summary}</p>}
      {(item.stocks !== undefined && item.stocks.length > 0) && (
        <div className="ksq-news-stocks">
          {item.stocks.map((tag) => (
            <button
              key={tag.code}
              type="button"
              className="ksq-news-stocktag"
              title={`让 Agent 快析 ${tag.name}（${tag.code}）`}
              onClick={(event) => {
                event.stopPropagation()
                onRead(item.title)
                onAsk(stockPrompt(tag))
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
      <div className="ksq-news-actions">
        <button
          type="button"
          className="ksq-linkbtn"
          onClick={(event) => {
            event.stopPropagation()
            onRead(item.title)
            onAsk(interpretPrompt(item))
          }}
        >
          让 Agent 解读 →
        </button>
      </div>
    </article>
  )
}

function StatsAside({ stats, onPickWord }: {
  stats: StatsPayload | null
  onPickWord: (word: string) => void
}): React.ReactElement {
  const max = stats === null ? 1 : Math.max(1, ...stats.frequency.map((point) => point.count))
  return (
    <aside className="ksq-news-stats" aria-label="新闻统计">
      <div className="ksq-news-stats-block">
        <div className="ksq-news-stats-head">
          热点主题 <span>近 6 小时</span>
        </div>
        {stats !== null && stats.themes.length === 0 && (
          <p className="ksq-news-stats-empty">留档积累中——运行一段时间后出现</p>
        )}
        <div className="ksq-news-trending">
          {stats?.themes.map((entry) => (
            <button
              key={`t-${entry.word}`}
              type="button"
              className="ksq-news-trendword"
              title={`检索「${entry.word}」`}
              onClick={() => onPickWord(entry.word)}
            >
              {entry.word}
              <em>{entry.count}</em>
            </button>
          ))}
        </div>
      </div>
      {stats !== null && stats.stocks.length > 0 && (
        <div className="ksq-news-stats-block">
          <div className="ksq-news-stats-head">
            提及标的 <span>近 6 小时</span>
          </div>
          <div className="ksq-news-trending">
            {stats.stocks.map((entry) => (
              <button
                key={`s-${entry.word}`}
                type="button"
                className="ksq-news-trendword"
                title={`检索「${entry.word}」`}
                onClick={() => onPickWord(entry.word)}
              >
                {entry.word}
                <em>{entry.count}</em>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="ksq-news-stats-block">
        <div className="ksq-news-stats-head">
          快讯频率 <span>近 24 小时</span>
        </div>
        {stats !== null && (
          <div className="ksq-news-freq" title="每小时留档条数（新闻密度≈市场情绪代理）">
            {stats.frequency.map((point) => (
              <div
                key={point.bucket}
                className="ksq-news-freq-bar"
                style={{ height: `${Math.max(4, Math.round((point.count / max) * 46))}px` }}
                title={`${new Date(point.bucket).toLocaleTimeString('zh-CN', { hour: '2-digit' })}时 · ${point.count} 条`}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
