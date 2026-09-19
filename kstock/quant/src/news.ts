/**
 * 落地页财经快讯（1.x landing-news 的 TS 移植，替代 akshare 依赖）。
 *
 * 主源：东方财富全球财经快讯（np-weblist.eastmoney.com 公开接口，免费无限流）；
 * 主源不可用或条目不足时回退央视新闻联播目录（api.cntv.cn 公开 JSON）。
 * 内存缓存 60 秒；全部失败时返回空列表——落地页快讯是匿名增强信息，
 * 绝不阻塞登录入口，也不缓存失败结果（1.x 同语义）。
 * @module @kstock/quant/news
 */

export interface LandingNewsItem {
  title: string
  source: string
  published_at: string
  url: string
  summary: string
}

export interface LandingNewsPayload {
  items: LandingNewsItem[]
  updated_at: string
}

/** 缓存时长与 1.x gateway 一致。 */
const CACHE_TTL_MS = 60_000

/** 落地页最多展示 10 条（1.x LandingPage slice(0, 10)）。 */
const MAX_ITEMS = 10

const HTTP_TIMEOUT_MS = 8_000

/** 部分公开接口会拒绝非常规 UA（requests/fetch 默认值），带浏览器 UA。 */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

let cache: { at: number; payload: LandingNewsPayload } | null = null
let inflight: Promise<LandingNewsPayload> | null = null

/** 东方财富全球财经快讯（akshare stock_info_global_em 的同源接口）。 */
async function fetchEastmoney(limit: number): Promise<LandingNewsItem[]> {
  const params = new URLSearchParams({
    client: 'web',
    biz: 'web_724',
    fastColumn: '102',
    sortEnd: '',
    pageSize: '50',
    req_trace: String(Date.now()),
  })
  const response = await fetch(`https://np-weblist.eastmoney.com/comm/web/getFastNewsList?${params}`, {
    headers: { accept: 'application/json', 'user-agent': BROWSER_UA },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`eastmoney ${response.status}`)
  const payload = await response.json() as {
    data?: { fastNewsList?: Array<{ title?: unknown; summary?: unknown; showTime?: unknown; code?: unknown }> }
  }
  const items: LandingNewsItem[] = []
  for (const row of payload.data?.fastNewsList ?? []) {
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (title === '') continue
    const code = typeof row.code === 'string' ? row.code : ''
    items.push({
      title,
      source: '东方财富',
      published_at: typeof row.showTime === 'string' ? row.showTime.trim() : '',
      // 快讯详情页为 finance.eastmoney.com 文章页（code 即文章 id）。
      url: code !== '' ? `https://finance.eastmoney.com/a/${encodeURIComponent(code)}.html` : '',
      summary: typeof row.summary === 'string' ? row.summary.slice(0, 180) : '',
    })
    if (items.length >= limit) break
  }
  return items
}

/** 央视新闻联播目录（近 3 天，去重补足主源缺口）。 */
async function fetchCctv(limit: number): Promise<LandingNewsItem[]> {
  const items: LandingNewsItem[] = []
  const columnId = 'TOPC1451528971114112' // tv.cctv.com 新闻联播栏目
  const now = Date.now()
  for (let offset = 0; offset < 3 && items.length < limit; offset += 1) {
    const day = new Date(now - offset * 86_400_000)
    const pd = [
      String(day.getFullYear()),
      String(day.getMonth() + 1).padStart(2, '0'),
      String(day.getDate()).padStart(2, '0'),
    ].join('')
    const params = new URLSearchParams({
      id: columnId,
      n: '24',
      sort: 'desc',
      p: '1',
      pd,
      serviceId: 'tvcctv',
    })
    try {
      const response = await fetch(`https://api.cntv.cn/NewVideo/getVideoListByColumn?${params}`, {
        headers: { accept: 'application/json', 'user-agent': BROWSER_UA },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      })
      if (!response.ok) continue
      const payload = await response.json() as {
        data?: { list?: Array<{ title?: unknown; brief?: unknown; time?: unknown; url?: unknown }> }
      }
      for (const row of payload.data?.list ?? []) {
        const title = typeof row.title === 'string' ? row.title.replace('[视频]', '').trim() : ''
        if (title === '' || items.some((item) => item.title === title)) continue
        items.push({
          title,
          source: '央视新闻',
          published_at: typeof row.time === 'string' && row.time.trim() !== '' ? row.time.trim() : pd,
          url: typeof row.url === 'string' && /^https?:\/\//.test(row.url) ? row.url : '',
          summary: typeof row.brief === 'string' ? row.brief.slice(0, 180) : '',
        })
        if (items.length >= limit) break
      }
    } catch {
      // 单日失败跳过，继续更早一天。
    }
  }
  return items
}

/** 刷新一次快讯（主源优先、备源补足；不缓存失败结果）。 */
async function refreshLandingNews(): Promise<LandingNewsPayload> {
  let items: LandingNewsItem[] = []
  try {
    items = await fetchEastmoney(MAX_ITEMS)
  } catch {
    // 主源不可用（无网/接口变更）时落到备源，与 1.x 的降级次序一致。
  }
  if (items.length < MAX_ITEMS) {
    try {
      items = [...items, ...(await fetchCctv(MAX_ITEMS - items.length))]
    } catch {
      // 备源也失败则保留已获取条目（可能为空）。
    }
  }
  if (items.length > 0) {
    cache = { at: Date.now(), payload: { items, updated_at: new Date().toISOString() } }
  }
  return { items, updated_at: new Date().toISOString() }
}

/**
 * 读取落地页快讯：60 秒内存缓存；并发请求合并到同一次刷新。
 * 失败不抛错——返回空列表由落地页渲染空态。
 */
export async function landingNews(): Promise<LandingNewsPayload> {
  if (cache !== null && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.payload
  }
  if (inflight === null) {
    inflight = refreshLandingNews().finally(() => {
      inflight = null
    })
  }
  return inflight
}

/** 数据源连接状态（1.x data-source-status：只报是否配置，绝不回传密钥）。 */
export interface DataSourceStatus {
  id: 'tushare' | 'iwencai'
  label: string
  env_name: string
  configured: boolean
}

/** 与 1.x scripts/kstock_data_sources.py 的 `_DATA_SOURCES` 一致。 */
const DATA_SOURCES: Array<['tushare' | 'iwencai', string, string]> = [
  ['tushare', 'Tushare Pro', 'TUSHARE_TOKEN'],
  ['iwencai', '同花顺问财', 'IWENCAI_API_KEY'],
]

export function dataSourceStatus(): { sources: DataSourceStatus[] } {
  return {
    sources: DATA_SOURCES.map(([id, label, envName]) => ({
      id,
      label,
      env_name: envName,
      configured: Boolean(process.env[envName]),
    })),
  }
}
