/**
 * 量化四库的客户端数据层：同源 fetch `/kstock-api/*`。
 *
 * 形状与 1.x `apps/desktop/src/lib/*Client.ts` 保持一致（服务端路由由
 * @kstock/quant 宿主半端提供，路径从 `/api/v1/kstock/*` 换成
 * `/kstock-api/*`）。错误统一抛 `KsqError`（带 HTTP 状态码）。
 */

/** 归一化的接口错误（detail 文案来自服务端）。 */
export class KsqError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    let detail = `请求失败（${response.status}）`
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      // 非 JSON 错误体保留默认文案
    }
    throw new KsqError(response.status, detail)
  }
  return (await response.json()) as T
}

function get<T>(path: string): Promise<T> {
  return request<T>(path)
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

/** JSON.stringify 丢 undefined 字段，减少服务端二义性。 */
function jsonBody(body: Record<string, unknown>): { method: 'POST' | 'PATCH'; headers: Record<string, string>; body: string } {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
}

// ── 策略库 ────────────────────────────────────────────────────────

export interface StrategyRunSummary {
  run_id: string
  strategy_id: string
  version: number
  data_start: string
  data_end: string
  rules: Record<string, unknown>
  metrics: Record<string, unknown>
  created_at: string
}

export interface Strategy {
  strategy_id: string
  name: string
  hypothesis: string
  status: string
  current_version: number
  created_at: string
  updated_at: string
  latest_run?: StrategyRunSummary | null
}

export interface StrategyVersion {
  strategy_id: string
  version: number
  parent_version: number | null
  code_sha256: string
  code_bytes: number
  params: Record<string, unknown>
  change_note: string
  created_at: string
}

export interface StrategyRunComparison {
  strategy_id: string
  runs: StrategyRunSummary[]
  comparable: boolean
  notes: string[]
}

export interface StrategyEquity {
  run_id: string
  version: number
  data_start: string
  data_end: string
  equity: unknown
}

/** 交易清单附件（trades.json，形状由 agent 写入，宽松 unknown）。 */
export interface StrategyRunTrades {
  run_id: string
  version: number
  trades: unknown
}

export const listStrategies = () => get<Strategy[]>('/kstock-api/strategies')
export const listStrategyVersions = (id: string) => get<StrategyVersion[]>(`/kstock-api/strategies/${encodeURIComponent(id)}/versions`)
export const listStrategyRuns = (id: string) => get<StrategyRunSummary[]>(`/kstock-api/strategies/${encodeURIComponent(id)}/runs`)
export const compareStrategyRuns = (id: string, runIds: string[]) =>
  get<StrategyRunComparison>(`/kstock-api/strategies/${encodeURIComponent(id)}/compare?runs=${runIds.map(encodeURIComponent).join(',')}`)
export const getStrategyRunEquity = (id: string, runId: string) =>
  get<StrategyEquity>(`/kstock-api/strategies/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/equity`)
export const getStrategyRunTrades = (id: string, runId: string) =>
  get<StrategyRunTrades>(`/kstock-api/strategies/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/trades`)
export const patchStrategy = (id: string, patch: { name?: string; status?: string; hypothesis?: string }) =>
  request<Strategy>(`/kstock-api/strategies/${encodeURIComponent(id)}`, { ...jsonBody(patch), method: 'PATCH' })

// ── 因子库 ────────────────────────────────────────────────────────

export interface FactorRunSummary {
  run_id: string
  factor_id: string
  version: number
  universe: string
  /** 1.x 类型残留字段：当前表结构无此列（区间在 config 里），可选。 */
  data_start?: string
  data_end?: string
  config: Record<string, unknown>
  metrics: Record<string, unknown>
  ic_series_path?: string | null
  layers_path?: string | null
  created_at: string
}

export interface Factor {
  factor_id: string
  name: string
  hypothesis: string
  category: string
  status: string
  current_version: number
  created_at: string
  updated_at: string
  latest_run?: FactorRunSummary | null
}

export interface FactorVersion {
  factor_id: string
  version: number
  parent_version: number | null
  code_sha256: string
  code_bytes: number
  params: Record<string, unknown>
  change_note: string
  created_at: string
}

export interface FactorRunComparison {
  factor_id: string
  runs: FactorRunSummary[]
  comparable: boolean
  notes: string[]
}

export interface FactorRunIcSeries {
  run_id: string
  version: number
  universe: string
  data_start: string
  data_end: string
  ic_series: unknown
}

/** 分层回测附件（layers.json，形状由 agent 写入，宽松 unknown）。 */
export interface FactorRunLayers {
  run_id: string
  version: number
  data_start: string
  data_end: string
  layers: unknown
}

export const listFactors = () => get<Factor[]>('/kstock-api/factors')
export const listFactorVersions = (id: string) => get<FactorVersion[]>(`/kstock-api/factors/${encodeURIComponent(id)}/versions`)
export const listFactorRuns = (id: string) => get<FactorRunSummary[]>(`/kstock-api/factors/${encodeURIComponent(id)}/runs`)
export const compareFactorRuns = (id: string, runIds: string[]) =>
  get<FactorRunComparison>(`/kstock-api/factors/${encodeURIComponent(id)}/compare?runs=${runIds.map(encodeURIComponent).join(',')}`)
export const getFactorRunIcSeries = (id: string, runId: string) =>
  get<FactorRunIcSeries>(`/kstock-api/factors/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/ic_series`)
export const getFactorRunLayers = (id: string, runId: string) =>
  get<FactorRunLayers>(`/kstock-api/factors/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/layers`)
export const patchFactor = (id: string, patch: { name?: string; status?: string; hypothesis?: string }) =>
  request<Factor>(`/kstock-api/factors/${encodeURIComponent(id)}`, { ...jsonBody(patch), method: 'PATCH' })

// ── 选股库 ────────────────────────────────────────────────────────

export interface SelectionRunSummary {
  run_id: string
  selection_id: string
  version: number
  trade_date: string
  universe: string
  rules: Record<string, unknown>
  metrics: Record<string, unknown>
  report_path?: string | null
  picks_path?: string | null
  created_at: string
}

export interface Selection {
  selection_id: string
  name: string
  criteria: string
  status: string
  current_version: number
  created_at: string
  updated_at: string
  latest_run?: SelectionRunSummary | null
}

export interface SelectionVersion {
  selection_id: string
  version: number
  parent_version: number | null
  criteria: Record<string, unknown>
  criteria_bytes: number
  params: Record<string, unknown>
  change_note: string
  created_at: string
}

export interface SelectionRunComparison {
  selection_id: string
  runs: SelectionRunSummary[]
  comparable: boolean
  notes: string[]
}

export interface SelectionRunPicks {
  run_id: string
  version: number
  trade_date: string
  picks: Array<Record<string, unknown>>
}

export interface SelectionRunReport {
  run_id: string
  version: number
  trade_date: string
  report: string
}

export const listSelections = () => get<Selection[]>('/kstock-api/selections')
export const listSelectionVersions = (id: string) => get<SelectionVersion[]>(`/kstock-api/selections/${encodeURIComponent(id)}/versions`)
export const listSelectionRuns = (id: string) => get<SelectionRunSummary[]>(`/kstock-api/selections/${encodeURIComponent(id)}/runs`)
export const compareSelectionRuns = (id: string, runIds: string[]) =>
  get<SelectionRunComparison>(`/kstock-api/selections/${encodeURIComponent(id)}/compare?runs=${runIds.map(encodeURIComponent).join(',')}`)
export const getSelectionRunPicks = (id: string, runId: string) =>
  get<SelectionRunPicks>(`/kstock-api/selections/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/picks`)
export const getSelectionRunReport = (id: string, runId: string) =>
  get<SelectionRunReport>(`/kstock-api/selections/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/report`)

// ── 报告库 ────────────────────────────────────────────────────────

export interface ReportLibraryItem {
  report_id: string
  user_id: string
  thread_id: string
  title: string
  symbol: string | null
  report_type: string
  generated_at: string
  period_start: string | null
  period_end: string | null
  risk_level: string | null
  coverage_status: string | null
  relative_path: string
  size_bytes: number
  content_url?: string
}

export async function listReports(filters: { date?: string; symbol?: string; query?: string } = {}): Promise<ReportLibraryItem[]> {
  const params = new URLSearchParams()
  if (filters.date) params.set('date', filters.date)
  if (filters.symbol) params.set('symbol', filters.symbol)
  if (filters.query) params.set('query', filters.query)
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return (await get<{ reports: ReportLibraryItem[] }>(`/kstock-api/reports${suffix}`)).reports
}

export async function fetchReportHtml(reportId: string): Promise<string> {
  const response = await fetch(`/kstock-api/reports/${encodeURIComponent(reportId)}/content`)
  if (!response.ok) throw new KsqError(response.status, `报告加载失败（${response.status}）`)
  return response.text()
}

/** 报告 HTML 的 blob 预览地址。显式带 utf-8 charset——blob 文档不继承响应头，缺失时中文会被按 windows-1252 解码。 */
export function reportBlobUrl(html: string): string {
  return URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
}

export const deleteReport = (reportId: string) =>
  request<{ deleted: boolean }>(`/kstock-api/reports/${encodeURIComponent(reportId)}`, { method: 'DELETE' })
