/**
 * A 股标的字典：新闻标的识别与热词统计的匹配字典。
 *
 * tushare stock_basic（list_status=L）拉全量代码/名称/行业，24 小时内存
 * 缓存（约 5k 条，1-2MB）；无 TUSHARE_TOKEN 或拉取失败返回 null——
 * 标的识别停用、诚实降级，绝不阻塞新闻流本身（与落地页快讯同口径）。
 * @module @kstock/quant/stocks
 */

/** 标的引用（识别结果与字典条目共用形态）。 */
export interface StockRef {
  code: string
  name: string
  industry: string
}

const CACHE_TTL_MS = 24 * 3_600_000
const HTTP_TIMEOUT_MS = 15_000

let cache: { at: number; stocks: StockRef[] } | null = null
let inflight: Promise<StockRef[] | null> | null = null

/**
 * 宏观/主题热词表（字典匹配用，确定性无分词依赖；行业词另有
 * stock_basic 的 industry 字段动态补充）。
 */
export const MACRO_WORDS: readonly string[] = [
  '美联储', '加息', '降息', '缩表', '通胀', '通缩', 'CPI', 'PPI', 'PMI', 'GDP',
  '关税', '制裁', '出口管制', '汇率', '降准', 'LPR', '国债', '地方债',
  '注册制', 'IPO', '回购', '增持', '减持', '并购', '重组', '分红', '财报',
  '业绩预告', '产能', '涨价', '降价', '新能源', '半导体', '人工智能',
  '机器人', '算力', '芯片', '锂矿', '光伏', '储能', '电动车', '智能驾驶',
  '医药', '创新药', '白酒', '地产', '券商', '银行', '保险', '军工',
  '黄金', '原油', '铜', '稀土', '数据要素', '低空经济', '商业航天',
]

/**
 * 读取标的字典（按名称长度降序——贪心匹配先吃长名，避免「中国平安」
 * 被「平安」类短名截断）。失败返回 null。
 */
export async function stockUniverse(): Promise<StockRef[] | null> {
  const token = process.env.TUSHARE_TOKEN
  if (typeof token !== 'string' || token === '') return null
  if (cache !== null && Date.now() - cache.at < CACHE_TTL_MS) return cache.stocks
  if (inflight !== null) return inflight
  inflight = (async () => {
    try {
      const response = await fetch('https://api.tushare.pro', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          api_name: 'stock_basic',
          token,
          params: { list_status: 'L' },
          fields: 'ts_code,name,industry',
        }),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      })
      if (!response.ok) return null
      const payload = await response.json() as {
        code?: number
        data?: { fields?: string[]; items?: Array<Array<unknown>> }
      }
      if (payload.code !== 0 || !Array.isArray(payload.data?.items)) return null
      const stocks: StockRef[] = []
      for (const row of payload.data?.items ?? []) {
        const [code, name, industry] = row
        if (typeof code !== 'string' || typeof name !== 'string' || name === '') continue
        stocks.push({
          code,
          name,
          industry: typeof industry === 'string' ? industry : '',
        })
      }
      if (stocks.length === 0) return null
      stocks.sort((left, right) => right.name.length - left.name.length)
      cache = { at: Date.now(), stocks }
      return stocks
    } catch {
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** 主题词全集（宏观词表 + 行业字段去重），热词「热点主题」榜用。 */
export function themeWords(stocks: StockRef[]): string[] {
  const words = new Set<string>(MACRO_WORDS)
  for (const stock of stocks) {
    if (stock.industry !== '') words.add(stock.industry)
  }
  return [...words]
}

/** 标的名词全集（证券简称，歧义简称排除），热词「提及标的」榜用。 */
export function stockNames(stocks: StockRef[]): string[] {
  const names = new Set<string>()
  for (const stock of stocks) {
    if (stock.name.length >= 2 && !AMBIGUOUS_NAMES.has(stock.name)) names.add(stock.name)
  }
  return [...names]
}

/**
 * 歧义简称排除表：与日常用语/行业词完全重合的证券简称（标题命中是
 * 普通词而非指代公司）——如「机器人」既是 300024 的简称也是行业常用
 * 词，标注会大量误报，识别侧跳过（热词榜仍作为行业词统计）。
 */
const AMBIGUOUS_NAMES: ReadonlySet<string> = new Set(['机器人'])

/**
 * 在文本中识别标的（标题+摘要联合匹配；长名优先；每条最多 cap 个，
 * 跳过被更长已命中名完全覆盖的短名——如「中国平安」命中后不再报
 * 「平安银行」之外的伪子串）。
 */
export function matchStocks(text: string, stocks: StockRef[], cap = 3): StockRef[] {
  const hits: StockRef[] = []
  let consumed = ''
  for (const stock of stocks) {
    if (hits.length >= cap) break
    if (AMBIGUOUS_NAMES.has(stock.name)) continue
    if (!text.includes(stock.name)) continue
    // 已命中名是当前名的前缀子串（同段重叠）则跳过，避免一家拆两家。
    if (consumed !== '' && consumed.includes(stock.name)) continue
    hits.push(stock)
    consumed += stock.name
  }
  return hits
}
