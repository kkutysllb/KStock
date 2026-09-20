/**
 * @kstock/quant — KStock 量化库插件，node 半端。
 *
 * 四库（策略/因子/选股/报告）作为引擎插件的宿主侧：node:sqlite 直连既有
 * `product/kstock.db`（schema 与 1.x 完全兼容，用户数据无损），并经
 * webserver 注册 `/kstock-api/*` 数据路由，供量化客户端页面与 agent
 * 侧消费。不引入独立业务进程——数据面就在引擎插件体系内。
 * @module @kstock/quant
 */

import { readFileSync } from 'node:fs'
import { StoreError, factorStore, selectionStore, strategyStore, type LibraryStore } from './store.ts'
import { ReportsStore } from './reports.ts'
import { dataSourceStatus, landingNews, workspaceNews } from './news.ts'
import { NewsStore } from './news-store.ts'
import { stockNames, stockUniverse, themeWords } from './stocks.ts'
import { dataSourcesView, saveDataSources } from './datasources.ts'
import { dependenciesView } from './deps.ts'

/** 非 JSON 响应的直通形态（报告 HTML 正文等）。 */
class RawResponse {
  constructor(
    readonly status: number,
    readonly headers: Record<string, string>,
    readonly body: string | Buffer,
  ) {}
}

interface ResponseLike {
  writeHead(code: number, headers?: Record<string, string>): unknown
  end(body?: unknown): unknown
}

interface RequestLike {
  url?: string | undefined
  method?: string | undefined
  on(event: 'data', cb: (chunk: Buffer) => void): unknown
  on(event: 'end', cb: () => void): unknown
  on(event: 'error', cb: (error: Error) => void): unknown
}

interface WebServerLike {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: RequestLike, res: ResponseLike) => void | Promise<void>
  }): () => void
}

/** 读取请求体并解析 JSON；空体返回空对象。 */
function readJson(req: RequestLike): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf-8')
      if (text === '') return resolve({})
      try {
        resolve(JSON.parse(text) as Record<string, unknown>)
      } catch {
        reject(new StoreError(422, '请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ResponseLike, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** 公共只读接口不支持的写方法统一 405。 */
function throwMethod(method: string): never {
  throw new StoreError(405, `method ${method} not allowed`)
}

/** 桌面单用户数据桶。 */
const USER_ID = 'kstock-local'

/** 必需服务：webserver 路由表。 */
export const inject = ['webServer'] as const

/**
 * 注册三库数据路由。数据根目录取 `KSTOCK_APP_DATA_DIR`（Electron 托管
 * 进程注入；缺省回落 ~/.kstock，与 1.x 一致）。
 */
export function apply(ctx: { webServer: WebServerLike }): void {
  const dataRoot = process.env.KSTOCK_APP_DATA_DIR ?? `${process.env.HOME ?? ''}/.kstock`
  const stores: Record<string, LibraryStore> = {
    strategies: strategyStore(dataRoot),
    factors: factorStore(dataRoot),
    selections: selectionStore(dataRoot),
  }
  const reports = new ReportsStore(dataRoot)
  const newsArchive = new NewsStore(dataRoot)

  ctx.webServer.register({
    kind: 'prefix',
    path: '/kstock-api',
    handler: async (req, res) => {
      try {
        const result = await dispatch(stores, reports, req, dataRoot, newsArchive)
        if (result instanceof RawResponse) {
          res.writeHead(result.status, result.headers)
          res.end(result.body)
        } else {
          sendJson(res, 200, result)
        }
      } catch (error) {
        if (error instanceof StoreError) sendJson(res, error.status, { detail: error.message })
        else sendJson(res, 500, { detail: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}

/** 各库实体的文本列取值（create/PATCH 共用）。 */
function entityText(libraryKey: string, body: Record<string, unknown>, create: boolean): Record<string, string> {
  const text: Record<string, string> = {}
  if (body.hypothesis !== undefined && libraryKey !== 'selections') text.hypothesis = String(body.hypothesis)
  if (create && libraryKey === 'factors') text.category = String(body.category ?? 'custom')
  if (body.criteria !== undefined && libraryKey === 'selections') text.criteria = String(body.criteria)
  return text
}

async function dispatch(
  stores: Record<string, LibraryStore>,
  reports: ReportsStore,
  req: RequestLike,
  dataRoot: string,
  newsArchive: NewsStore,
): Promise<unknown> {
  const url = new URL(req.url ?? '/', 'http://local')
  const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean)
  // segments: ['kstock-api', <library>, ...rest]
  const libraryKey = segments[1]
  const method = (req.method ?? 'GET').toUpperCase()

  // 落地页公共增强接口（匿名可达，与 1.x gateway 公共路由同语义）。
  if (libraryKey === 'landing-news') return method === 'GET' ? landingNews() : throwMethod(method)
  // 工作台「财经新闻」面板 feed（侧栏菜单，30 条独立缓存槽 + 标的标注）；
  // 每次读取顺手滚动留档（INSERT OR IGNORE 幂等，30 行毫秒级）。
  if (libraryKey === 'workspace-news') {
    if (method !== 'GET') throwMethod(method)
    const payload = await workspaceNews()
    try {
      newsArchive.archive(payload.items)
    } catch (error) {
      console.error('[kstock-news] archive failed:', error)
    }
    return payload
  }
  // 历史检索：?q=关键词&hours=24&limit=50（留档库 LIKE 匹配）。
  if (libraryKey === 'news-archive') {
    if (method === 'GET') {
      const query = (url.searchParams.get('q') ?? '').trim()
      const hours = Math.min(720, Math.max(1, Number(url.searchParams.get('hours')) || 24))
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50))
      return { items: newsArchive.search(query, hours, limit), hours, limit }
    }
    throwMethod(method)
  }
  // 面板统计：热点主题榜（6h 行业/宏观词频，count≥2 优先）+ 提及标的榜
  // （6h 股名词频）+ 24h 逐小时频率。
  if (libraryKey === 'news-stats') {
    if (method === 'GET') {
      const universe = await stockUniverse()
      const themesAll = universe !== null ? themeWords(universe) : []
      const stocksAll = universe !== null ? stockNames(universe) : []
      // count≥2 的真热点优先；不足 3 个时回退全部 Top（冷启动不留空）。
      const pick = (words: string[], limit: number): Array<{ word: string; count: number }> => {
        const ranked = newsArchive.trending(6 * 3_600_000, words.length, words)
        const hot = ranked.filter((entry) => entry.count >= 2).slice(0, limit)
        return hot.length >= 3 ? hot : ranked.slice(0, limit)
      }
      return {
        themes: pick(themesAll, 8),
        stocks: pick(stocksAll, 6),
        frequency: newsArchive.frequency(24 * 3_600_000, 3_600_000),
        dictionary_size: themesAll.length + stocksAll.length,
      }
    }
    throwMethod(method)
  }
  if (libraryKey === 'data-source-status') return method === 'GET' ? dataSourceStatus() : throwMethod(method)
  // 引擎 Python 依赖体检（设置页/诊断用）：逐依赖 import 探针与版本。
  if (libraryKey === 'dependencies') {
    if (method === 'GET') return dependenciesView(dataRoot)
    throwMethod(method)
  }
  // 数据源凭据配置面（设置页）：GET 状态 / PUT 合并写 secrets.env。
  if (libraryKey === 'data-sources') {
    if (method === 'GET') return dataSourcesView(dataRoot)
    if (method === 'PUT') {
      const body = await readJson(req)
      return saveDataSources(dataRoot, body.values)
    }
    throwMethod(method)
  }
  if (libraryKey === 'reports') return dispatchReports(reports, req, url, method, segments.slice(2))
  const library = libraryKey ?? ''
  const store = stores[library]
  if (store === undefined) throw new StoreError(404, 'not found')
  const singular: Record<string, string> = { strategies: 'strategy', factors: 'factor', selections: 'selection' }
  const key = singular[library]

  const rest = segments.slice(2)
  const [entityId, kind, third, fourth] = rest

  // /{library}
  if (entityId === undefined) {
    if (method === 'GET') return store.list(USER_ID)
    if (method === 'POST') {
      const body = await readJson(req)
      return store.create(USER_ID, String(body.name ?? ''), entityText(library, body, true))
    }
  }
  // /{library}/{entityId}
  if (kind === undefined) {
    if (method === 'GET') return store.get(USER_ID, entityId!)
    if (method === 'PATCH') {
      const body = await readJson(req)
      return store.update(USER_ID, entityId!, {
        name: body.name === undefined ? undefined : String(body.name),
        status: body.status === undefined ? undefined : String(body.status),
        text: entityText(library, body, false),
      })
    }
  }
  // /{library}/{entityId}/versions[/{version}]
  if (kind === 'versions') {
    if (third === undefined) {
      if (method === 'GET') return store.listVersions(USER_ID, entityId!)
      if (method === 'POST') {
        const body = await readJson(req)
        return store.saveVersion(USER_ID, entityId!, {
          code: body.code === undefined ? undefined : String(body.code),
          criteria: body.criteria,
          params: body.params,
          change_note: body.change_note === undefined ? undefined : String(body.change_note),
          parent_version: body.parent_version === undefined || body.parent_version === null
            ? null
            : Number(body.parent_version),
        })
      }
    }
    return store.getVersion(USER_ID, entityId!, Number(third))
  }
  // /{library}/{entityId}/runs[/{runId}[/{attachment}]]
  if (kind === 'runs') {
    if (third === undefined) {
      if (method === 'GET') {
        const version = url.searchParams.get('version')
        return store.listRuns(USER_ID, entityId!, version === null ? undefined : Number(version))
      }
      if (method === 'POST') {
        const body = await readJson(req)
        return store.recordRun(USER_ID, entityId!, body)
      }
    }
    if (fourth !== undefined) {
      return store.getRunAttachment(USER_ID, entityId!, third!, fourth)
    }
    const runs = store.listRuns(USER_ID, entityId!)
    return runs.find(run => run.run_id === third) ?? (() => { throw new StoreError(404, `运行记录不存在：${third}`) })()
  }
  // /{library}/{entityId}/compare?runs=a,b
  if (kind === 'compare') {
    const runs = (url.searchParams.get('runs') ?? '').split(',').map(item => item.trim()).filter(Boolean)
    if (runs.length < 2) throw new StoreError(422, '对比至少需要 2 个 run_id（逗号分隔）')
    return store.compareRuns(USER_ID, entityId!, runs)
  }
  throw new StoreError(404, `not found: ${key}/${kind ?? ''}`)
}

/** 报告库路由：GET 列表/单条/正文、DELETE 删除、POST agent 入库口。 */
async function dispatchReports(
  store: ReportsStore,
  req: RequestLike,
  url: URL,
  method: string,
  rest: string[],
): Promise<unknown> {
  const [reportId, kind] = rest

  // /reports
  if (reportId === undefined) {
    if (method === 'GET') {
      return {
        reports: store.list(USER_ID, {
          date: url.searchParams.get('date') ?? undefined,
          symbol: url.searchParams.get('symbol') ?? undefined,
          query: url.searchParams.get('query') ?? undefined,
        }),
      }
    }
    if (method === 'POST') {
      const body = await readJson(req)
      return store.archive(USER_ID, {
        threadId: String(body.thread_id ?? ''),
        reportId: body.report_id === undefined ? undefined : String(body.report_id),
        title: body.title === undefined ? undefined : String(body.title),
        symbol: body.symbol === undefined ? undefined : String(body.symbol),
        reportType: body.report_type === undefined ? undefined : String(body.report_type),
        generatedAt: body.generated_at === undefined ? undefined : String(body.generated_at),
        periodStart: body.period_start === undefined ? undefined : String(body.period_start),
        periodEnd: body.period_end === undefined ? undefined : String(body.period_end),
        riskLevel: body.risk_level === undefined ? undefined : String(body.risk_level),
        coverageStatus: body.coverage_status === undefined ? undefined : String(body.coverage_status),
        content: String(body.content ?? ''),
      })
    }
  }
  // /reports/{id}
  if (kind === undefined) {
    if (method === 'GET') {
      const row = store.find(USER_ID, reportId!)
      if (row === null) throw new StoreError(404, '报告不存在')
      return { ...row, content_url: `/kstock-api/reports/${reportId}/content` }
    }
    if (method === 'DELETE') {
      store.delete(USER_ID, reportId!)
      return { deleted: true, report_id: reportId }
    }
  }
  // /reports/{id}/content — HTML 直出，CSP sandbox 隔离同源凭据（1.x 同款防线）。
  if (kind === 'content' && method === 'GET') {
    return new RawResponse(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': 'inline',
      'content-security-policy': 'sandbox allow-scripts',
      'x-content-type-options': 'nosniff',
    }, store.readContent(USER_ID, reportId!))
  }
  throw new StoreError(404, `not found: reports/${kind ?? ''}`)
}
