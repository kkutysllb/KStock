/**
 * 选股库面板：方案列表 + 要求版本时间线 + 运行归档（报告查看）+
 * 命中清单（P2：picks 表展开 + 每股「解读」联动会话）+
 * 跨期命中对比（重合分析）。移植自 1.x components/SelectionsLibrary.tsx。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  compareSelectionRuns,
  fetchReportHtml,
  getSelectionRunPicks,
  getSelectionRunReport,
  listSelectionRuns,
  listSelectionVersions,
  listSelections,
  reportBlobUrl,
  type Selection,
  type SelectionRunComparison,
  type SelectionRunPicks,
  type SelectionRunSummary,
  type SelectionVersion,
} from '@kstock/quant-ui'
import { IconCopy, IconPlay, IconTarget } from '@kstock/quant-ui'
import {
  CopyToast,
  ErrorLine,
  Loading,
  PreviewDialog,
  RefreshButton,
  TaskTargetMenu,
  formatDateTime,
  metric,
  statusBadge,
  useCopyPrompt,
  type UseWorkspaces,
} from '@kstock/quant-ui'
import { getAgentBridge, interpretPickPrompt } from './agent.ts'

/** picks 行（agent 按报告总表约定写入：rank/code/name/industry/score/
 * dv_ttm/pe_ttm/pb/roe/div_years_3y/trap_flags 等，宽松读取）。 */
type PickRow = Record<string, unknown>

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null
const asText = (value: unknown): string =>
  typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
const fmtPct = (value: unknown): string => {
  const n = asNumber(value)
  return n === null ? asText(value) || '—' : `${n.toFixed(2)}%`
}
const fmtNum = (value: unknown, digits = 2): string => {
  const n = asNumber(value)
  return n === null ? asText(value) || '—' : n.toFixed(digits)
}

/** 共振股数 > 0 绿。 */
function selectionMetricClass(key: string, value: unknown): string {
  if (typeof value !== 'number') return ''
  if (key === 'consensus_count') return value > 0 ? 'ksq-up' : ''
  return ''
}

/** 版本口径解析（历史双重编码防御：字符串先解一层）。 */
function parseCriteria(version: SelectionVersion): Record<string, unknown> {
  let value: unknown = version.criteria
  if (typeof value === 'string') {
    const text = value.trim()
    try {
      value = JSON.parse(text)
    } catch {
      return { summary: text }
    }
  }
  return (value ?? {}) as Record<string, unknown>
}

/** 口径一行摘要（summary 字段 → pipeline 字段 → 字段名列表）。 */
function criteriaSummaryText(record: Record<string, unknown>): string {
  const summary = record.summary
  if (typeof summary === 'string' && summary.trim() !== '') return summary
  const pipeline = record.pipeline
  if (typeof pipeline === 'string' && pipeline.trim() !== '') return pipeline
  const keys = Object.keys(record)
  return keys.length > 0 ? `（口径字段：${keys.join(' / ')}）` : '（空口径）'
}

/** 已知闸门参数 → 展示标签（gates_params 数值键，agent 常用口径）。 */
const GATE_LABELS: ReadonlyArray<[string, string, string]> = [
  ['dv_ttm_min', '股息率%', '≥'],
  ['dv_ttm_max', '股息率%', '≤'],
  ['pe_ttm_min', 'PE', '≥'],
  ['pe_ttm_max', 'PE', '≤'],
  ['min_div_years_3y', '3年分红', '≥'],
]

/** 口径 → 条件芯片（P4）：识别 gates_params 闸门 / factors 权重 Top3 /
 * top_n；识别不出时回退空数组（时间线仍显示文本摘要）。 */
function criteriaChips(record: Record<string, unknown>): string[] {
  const chips: string[] = []
  const params = record.gates_params
  if (typeof params === 'object' && params !== null) {
    for (const [key, label, op] of GATE_LABELS) {
      const value = (params as Record<string, unknown>)[key]
      if (typeof value === 'number' && Number.isFinite(value)) chips.push(`${label} ${op} ${value}`)
    }
  }
  const factors = record.factors
  if (Array.isArray(factors)) {
    const weights = factors
      .map(item => (typeof item === 'object' && item !== null ? item as Record<string, unknown> : null))
      .filter((item): item is Record<string, unknown> => item !== null)
      .map(item => ({ field: String(item.field ?? ''), weight: Number(item.weight) }))
      .filter(item => item.field !== '' && Number.isFinite(item.weight) && item.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
    for (const item of weights) chips.push(`${item.field} ×${item.weight}`)
  }
  if (typeof record.top_n === 'number' && Number.isFinite(record.top_n)) chips.push(`Top${record.top_n}`)
  return chips
}

/** 命中清单 → 股票代码集合（对比重合分析用）。 */
function pickCodes(picks: SelectionRunPicks['picks']): Set<string> {
  return new Set(
    picks
      .map(item => (typeof item?.code === 'string' ? item.code : null))
      .filter((code): code is string => Boolean(code)),
  )
}

const METRIC_KEYS = [
  ['hit_count', '命中数'],
  ['strategy_count', '策略数'],
  ['consensus_count', '共振股数'],
  ['top_n', 'TopN'],
] as const

/** 空态引导：让 agent 把最近一次选股任务结果归档进选股库的复制提示词。 */
const INGEST_PROMPT =
  '请把本工作区最近一次选股任务的结果归档进 KStock 选股库（引擎 http://127.0.0.1:18001，不可达则跳过并明说）。三步：' +
  '1) POST /kstock-api/selections，body {name: 方案名, criteria: 一句话口径}；' +
  '2) POST /kstock-api/selections/{selection_id}/versions，body {criteria: 结构化口径 JSON, change_note}；' +
  '3) POST /kstock-api/selections/{selection_id}/runs，body {version, trade_date, universe, rules, metrics, report: 报告全文, picks: 命中清单数组}。' +
  'picks 每项含 code（必须带 .SH/.SZ/.BJ 后缀）/name/score 等报告总表字段。' +
  '数据取自工作区 data/ 与 reports/ 下的真实产物，禁止编造。'

/** 运行报告视图：优先报告库 HTML 看板（blob iframe），无链或加载失败回退纯文本。 */
type ReportView = { runId: string; text: string; htmlUrl: string | null }

/** run 的 rules.report_id（阶段三报告库归档返回的看板链，有则直嵌）。 */
function runReportId(run: SelectionRunSummary | undefined): string | null {
  const value = run?.rules?.report_id
  return typeof value === 'string' && value ? value : null
}

/** 命中趋势（P3）：run 时间正序 mini 柱图——柱高 ∝ hit_count，
 * 绿色叠加 consensus_count；hover 显示 run 明细。单 run 即当前水平。 */
function RunsTrend({ runs }: { runs: SelectionRunSummary[] }): React.ReactElement | null {
  const asc = [...runs].reverse()
  if (asc.length === 0) return null
  const hitOf = (run: SelectionRunSummary): number => {
    const value = run.metrics?.hit_count
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }
  const consensusOf = (run: SelectionRunSummary): number => {
    const value = run.metrics?.consensus_count
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }
  const max = Math.max(1, ...asc.map(hitOf))
  return (
    <div className="ksq-trend" aria-label="运行趋势">
      <span className="ksq-trend-label">命中趋势</span>
      <div className="ksq-trend-bars">
        {asc.map(run => {
          const hit = hitOf(run)
          const consensus = consensusOf(run)
          const label = `v${run.version} · ${run.trade_date || run.run_id.slice(7, 15)} · 命中 ${hit}` +
            (consensus > 0 ? ` · 共振 ${consensus}` : '') + ` · ${formatDateTime(run.created_at)}`
          return (
            <span key={run.run_id} className="ksq-trend-col" title={label}>
              {consensus > 0 && <span className="ksq-trend-bar consensus" style={{ height: `${Math.max(6, Math.round(consensus / max * 100))}%` }} />}
              <span className="ksq-trend-bar" style={{ height: `${Math.max(6, Math.round(hit / max * 100))}%` }} />
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function SelectionsSection({ useWorkspaces }: { useWorkspaces?: UseWorkspaces } = {}) {
  const [selections, setSelections] = useState<Selection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [versions, setVersions] = useState<SelectionVersion[]>([])
  const [runs, setRuns] = useState<SelectionRunSummary[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [comparison, setComparison] = useState<SelectionRunComparison | null>(null)
  const [picksList, setPicksList] = useState<SelectionRunPicks[]>([])
  const [reportView, setReportView] = useState<ReportView | null>(null)
  const [picksView, setPicksView] = useState<SelectionRunPicks | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const { copy, toast } = useCopyPrompt()

  const reload = useCallback(async () => {
    setError(null)
    try {
      setSelections(await listSelections())
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载选股库失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const list = await listSelections()
      setSelections(list)
      if (selectedId) {
        const [versionList, runList] = await Promise.all([
          listSelectionVersions(selectedId),
          listSelectionRuns(selectedId),
        ])
        setVersions(versionList)
        setRuns(runList)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新选股库失败')
    } finally {
      setRefreshing(false)
    }
  }, [selectedId])

  const selected = selections.find(item => item.selection_id === selectedId) ?? null

  /** 关闭报告视图并释放 blob URL（函数式 setState 避免闭包过期）。 */
  const closeReportView = useCallback(() => {
    setReportView(current => {
      if (current?.htmlUrl) URL.revokeObjectURL(current.htmlUrl)
      return null
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setDetailLoading(true)
    setCompareIds([])
    setComparison(null)
    setPicksList([])
    closeReportView()
    setPicksView(null)
    setError(null)
    let active = true
    void (async () => {
      try {
        const [versionList, runList] = await Promise.all([
          listSelectionVersions(selectedId),
          listSelectionRuns(selectedId),
        ])
        if (!active) return
        setVersions(versionList)
        setRuns(runList)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '加载方案详情失败')
      } finally {
        if (active) setDetailLoading(false)
      }
    })()
    return () => { active = false }
  }, [selectedId])

  const toggleCompare = (runId: string) => {
    setCompareIds(current =>
      current.includes(runId)
        ? current.filter(id => id !== runId)
        : current.length >= 4
          ? current
          : [...current, runId],
    )
  }

  useEffect(() => {
    if (!selectedId || compareIds.length < 2) {
      setComparison(null)
      setPicksList([])
      return
    }
    let active = true
    void (async () => {
      try {
        const [result, ...lists] = await Promise.all([
          compareSelectionRuns(selectedId, compareIds),
          ...compareIds.map(runId => getSelectionRunPicks(selectedId, runId).catch(() => null)),
        ])
        if (!active) return
        setComparison(result)
        setPicksList(lists.filter((item): item is SelectionRunPicks => item !== null))
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '对比加载失败')
      }
    })()
    return () => { active = false }
  }, [selectedId, compareIds])

  const showReport = useCallback(async (runId: string) => {
    if (!selectedId) return
    if (reportView?.runId === runId) {
      closeReportView()
      return
    }
    const run = runs.find(item => item.run_id === runId)
    const reportId = runReportId(run)
    closeReportView()
    // 优先直嵌报告库 HTML 看板（rules.report_id 建链）；无链或看板
    // 不可用（被删/引擎不可达）回退 run 附件纯文本。
    if (reportId) {
      try {
        const html = await fetchReportHtml(reportId)
        setReportView({ runId, text: '', htmlUrl: reportBlobUrl(html) })
        return
      } catch {
        // 落回文本附件
      }
    }
    if (!run?.report_path) return
    try {
      const detail = await getSelectionRunReport(selectedId, runId)
      setReportView({ runId, text: detail.report, htmlUrl: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : '报告加载失败')
    }
  }, [selectedId, reportView, runs, closeReportView])

  /** 展开某 run 的命中清单（再点收起；未存 picks 报服务端 422 文案）。 */
  const togglePicks = useCallback(async (runId: string) => {
    if (!selectedId) return
    if (picksView?.run_id === runId) {
      setPicksView(null)
      return
    }
    try {
      setPicksView(await getSelectionRunPicks(selectedId, runId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '命中清单加载失败')
    }
  }, [selectedId, picksView])

  /** 命中清单排序：rank 全数值时按排名，否则按综合分降序。 */
  const sortedPicks = useMemo(() => {
    const rows = [...(picksView?.picks ?? [])]
    if (rows.length > 0 && rows.every(row => asNumber(row.rank) !== null)) {
      rows.sort((a, b) => (asNumber(a.rank)! - asNumber(b.rank)!))
      return rows
    }
    rows.sort((a, b) => (asNumber(b.score) ?? -Infinity) - (asNumber(a.score) ?? -Infinity))
    return rows
  }, [picksView])

  /** 单股「解读」（§26-10）：先弹目标选择菜单（pick 类型记忆），选完发送。 */
  const [pendingInterpret, setPendingInterpret] = useState<string | null>(null)
  const askPickInterpret = useCallback((row: PickRow) => {
    if (selected === null) return
    const bridge = getAgentBridge()
    if (bridge === null) {
      setError('会话联动不可用（sessions/layout 服务缺席）')
      return
    }
    setPendingInterpret(interpretPickPrompt({
      selectionName: selected.name,
      version: picksView?.version ?? selected.current_version,
      rank: asNumber(row.rank) ?? undefined,
      name: asText(row.name) || asText(row.code) || '该标的',
      code: asText(row.code),
      score: asNumber(row.score) ?? undefined,
      dvTtm: asNumber(row.dv_ttm) ?? undefined,
      trap: asText(row.trap_flags),
    }))
  }, [selected, picksView])

  const rerunPrompt = (version: SelectionVersion) =>
    `请重跑选股库中的「${selected?.name ?? ''}」（${selectedId}）：选股口径采用 v${version.version} 版本` +
    `（${criteriaSummaryText(parseCriteria(version))}），股票池与执行口径与该版本最近一次 run 保持一致` +
    `（无历史 run 则按口径默认执行）。跑完后把结果入库：` +
    `POST /kstock-api/selections/${selectedId}/runs，version=${version.version}，` +
    `附 trade_date/universe/rules/metrics/report（报告全文）/picks（命中清单）。`

  /** 命中重合分析：以所选第一个运行为基准，统计其余运行的保留/新增/剔除。 */
  const overlapRows = useMemo(() => {
    if (picksList.length < 2) return []
    const [base, ...rest] = picksList
    const baseCodes = pickCodes(base!.picks)
    return rest.map(item => {
      const codes = pickCodes(item.picks)
      const kept = [...codes].filter(code => baseCodes.has(code))
      const added = [...codes].filter(code => !baseCodes.has(code))
      const removed = [...baseCodes].filter(code => !codes.has(code))
      return {
        run: item,
        keptCount: kept.length,
        addedCount: added.length,
        removedCount: removed.length,
        keptSample: kept.slice(0, 5),
        addedSample: added.slice(0, 5),
      }
    })
  }, [picksList])

  return (
    <div className="ksq-body" aria-label="选股库">
      <div className="ksq-toolbar">
        <span className="ksq-count"><IconTarget size={13} /> {selections.length} 个方案</span>
        <RefreshButton refreshing={refreshing} onClick={() => void refresh()} label="刷新选股库" />
      </div>
      {error && <ErrorLine message={error} />}
      {loading ? <Loading text="加载选股库…" /> : (
        <div className="ksq-split">
          <aside className="ksq-list">
            {selections.length === 0
              ? <p className="ksq-hint">暂无方案。用右侧提示词把最近一次选股结果入库。</p>
              : selections.map(selection => (
                <button
                  key={selection.selection_id}
                  type="button"
                  className={`ksq-list-item ${selection.selection_id === selectedId ? 'active' : ''}`}
                  onClick={() => setSelectedId(selection.selection_id)}
                >
                  <span className="ksq-item-name">
                    <span className={`ksq-dot tone-${statusBadge(selection.status).tone}`} aria-hidden="true" />
                    <span className="ksq-name-text">{selection.name}</span>
                  </span>
                  <span className="ksq-item-meta">
                    <span>v{selection.current_version} · {statusBadge(selection.status).label}</span>
                    {selection.latest_run && (
                      <span className="ksq-chip">
                        命中 {metric(selection.latest_run, 'hit_count')}
                      </span>
                    )}
                  </span>
                </button>
              ))}
          </aside>

          <section className="ksq-detail">
            {!selected ? (
              selections.length === 0 ? (
                <div className="ksq-empty">
                  <strong>选股库还是空的</strong>
                  <p>选股任务的产物目前只落在工作区文件（data/ 与 reports/）里。归档进选股库后，这里会出现可回看、可重跑、可跨期对比的方案资产。</p>
                  <button className="ksq-linkbtn" type="button" onClick={() => copy(INGEST_PROMPT)}>
                    <IconCopy size={11} /> 复制「把最近一次选股结果入库」提示词
                  </button>
                  <p className="ksq-item-meta">粘贴到对话发送即可；后续选股任务会按 stock-screening-theme 阶段四自动归档。</p>
                </div>
              ) : (
                <p className="ksq-hint">从左侧选择一个方案查看要求时间线与运行归档。</p>
              )
            ) : detailLoading ? (
              <Loading text="加载方案详情…" />
            ) : (
              <>
                <header className="ksq-identity">
                  <div className="ksq-identity-head">
                    <h2>{selected.name}</h2>
                    <span className={`ksq-badge tone-${statusBadge(selected.status).tone}`}>{statusBadge(selected.status).label}</span>
                  </div>
                  <p className="ksq-hypothesis">{selected.criteria || '（未写选股要求口径）'}</p>
                  <p className="ksq-item-meta ksq-mono">
                    {selected.selection_id} · 当前 v{selected.current_version} · 更新于 {formatDateTime(selected.updated_at)}
                  </p>
                </header>

                <div>
                  <h3 className="ksq-section-title"><IconTarget size={14} /> 要求版本时间线</h3>
                  <div className="ksq-versions">
                    {versions.length === 0 ? <p className="ksq-hint">尚无版本。</p> : versions
                      .slice()
                      .reverse()
                      .map(version => {
                        const record = parseCriteria(version)
                        const chips = criteriaChips(record)
                        return (
                        <div
                          key={version.version}
                          className={`ksq-version ${version.version === selected.current_version ? 'latest' : ''}`}
                        >
                          <div className="ksq-version-head">
                            <strong>v{version.version}</strong>
                            {version.version === selected.current_version && <span className="ksq-badge tone-live">最新</span>}
                            <span className="ksq-item-meta">{formatDateTime(version.created_at)}</span>
                          </div>
                          {chips.length > 0 && (
                            <div className="ksq-chips" aria-label="口径条件">
                              {chips.map(chip => <span key={chip} className="ksq-chip">{chip}</span>)}
                            </div>
                          )}
                          <p className="ksq-version-note">{criteriaSummaryText(record)}</p>
                          <p className="ksq-item-meta">{version.change_note || '（无变更说明）'}</p>
                          <button className="ksq-linkbtn" type="button" onClick={() => copy(rerunPrompt(version))}>
                            <IconPlay size={11} /> <IconCopy size={11} /> 复制重跑提示词
                          </button>
                        </div>
                        )
                      })}
                  </div>
                </div>

                <div>
                  <h3 className="ksq-section-title">运行归档（勾选 2-4 个对比）</h3>
                  <RunsTrend runs={runs} />
                  {runs.length === 0 ? <p className="ksq-hint">尚无运行归档。</p> : (
                    <div className="ksq-table-wrap">
                    <table className="ksq-table">
                      <thead>
                        <tr>
                          <th>对比</th>
                          <th>run</th>
                          <th>版本</th>
                          <th>基准日</th>
                          <th>股票池</th>
                          <th>命中</th>
                          <th>共振</th>
                          <th>TopN</th>
                          <th>时间</th>
                          <th>清单 / 报告</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map(run => (
                          <tr key={run.run_id} className={compareIds.includes(run.run_id) ? 'selected' : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={compareIds.includes(run.run_id)}
                                onChange={() => toggleCompare(run.run_id)}
                                aria-label={`对比 run ${run.run_id}`}
                              />
                            </td>
                            <td className="ksq-mono" title={run.run_id}>{run.run_id.slice(7, 15)}</td>
                            <td>v{run.version}</td>
                            <td>{run.trade_date || '—'}</td>
                            <td className="ksq-cell-clip" title={run.universe || undefined}>{run.universe || '—'}</td>
                            <td className="num">{metric(run, 'hit_count')}</td>
                            <td className={`num ${selectionMetricClass('consensus_count', run.metrics?.consensus_count)}`}>{metric(run, 'consensus_count')}</td>
                            <td className="num">{metric(run, 'top_n')}</td>
                            <td>{formatDateTime(run.created_at)}</td>
                            <td>
                              {run.picks_path ? (
                                <button className="ksq-linkbtn" type="button" onClick={() => void togglePicks(run.run_id)}>
                                  {picksView?.run_id === run.run_id ? '收清单' : '清单'}
                                </button>
                              ) : null}
                              {(run.report_path || runReportId(run)) ? (
                                <>
                                  {run.picks_path ? ' ' : ''}
                                  <button className="ksq-linkbtn" type="button" onClick={() => void showReport(run.run_id)}>
                                    {reportView?.runId === run.run_id ? '收起' : runReportId(run) ? '看板' : '查看'}
                                  </button>
                                </>
                              ) : null}
                              {!run.picks_path && !run.report_path && !runReportId(run) ? '—' : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>

                {picksView && (
                  <div className="ksq-compare">
                    <h3>
                      命中清单（{picksView.run_id.slice(7, 15)} · v{picksView.version} · {picksView.trade_date || '—'} · {sortedPicks.length} 只）
                      <button className="ksq-linkbtn" type="button" onClick={() => setPicksView(null)}>收起</button>
                    </h3>
                    {sortedPicks.length === 0 ? <p className="ksq-hint">该 run 命中清单为空。</p> : (
                      <div className="ksq-table-wrap">
                        <table className="ksq-table">
                          <thead>
                            <tr>
                              <th>排名</th>
                              <th>代码</th>
                              <th>名称</th>
                              <th>行业</th>
                              <th>综合分</th>
                              <th>股息率TTM</th>
                              <th>PE</th>
                              <th>PB</th>
                              <th>ROE</th>
                              <th>3年分红</th>
                              <th>陷阱</th>
                              <th>解读</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedPicks.map((row, index) => {
                              const code = asText(row.code)
                              const trap = asText(row.trap_flags)
                              const hasTrap = trap !== '' && trap !== '—'
                              return (
                                <tr key={code || index}>
                                  <td className="num">{asText(row.rank) || index + 1}</td>
                                  <td className="ksq-mono">{code || '—'}</td>
                                  <td>{asText(row.name) || '—'}</td>
                                  <td className="ksq-cell-clip" title={asText(row.industry) || undefined}>{asText(row.industry) || '—'}</td>
                                  <td className="num">{asText(row.score) || '—'}</td>
                                  <td className="num">{fmtPct(row.dv_ttm)}</td>
                                  <td className="num">{fmtNum(row.pe_ttm)}</td>
                                  <td className="num">{fmtNum(row.pb)}</td>
                                  <td className="num">{fmtPct(row.roe)}</td>
                                  <td className="num">{asText(row.div_years_3y) || '—'}</td>
                                  <td>{hasTrap ? <span className="ksq-badge tone-bad" title={trap}>陷阱</span> : '—'}</td>
                                  <td>
                                    {code !== '' ? (
                                      <button className="ksq-linkbtn" type="button" onClick={() => askPickInterpret(row)}>解读</button>
                                    ) : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {reportView?.htmlUrl ? (
                  <PreviewDialog title="运行报告看板" onClose={closeReportView}>
                    <iframe title="运行报告看板" src={reportView.htmlUrl} sandbox="allow-scripts" />
                  </PreviewDialog>
                ) : reportView ? (
                  <div className="ksq-compare">
                    <h3>运行报告（{reportView.runId.slice(7, 15)} · 纯文本附件）</h3>
                    <pre className="ksq-criteria" style={{ maxHeight: 320 }}>{reportView.text}</pre>
                  </div>
                ) : null}

                {comparison && (
                  <div className="ksq-compare">
                    <h3>运行对比{comparison.comparable ? '（同口径，可严格对比）' : '（口径不一致，仅供参考）'}</h3>
                    {!comparison.comparable && comparison.notes.map(note => <p key={note} className="ksq-note">{note}</p>)}
                    <div className="ksq-table-wrap">
                    <table className="ksq-table">
                      <thead>
                        <tr>
                          <th>指标</th>
                          {comparison.runs.map(run => (
                            <th key={run.run_id} className="ksq-mono">v{run.version} · {run.trade_date || run.run_id.slice(7, 15)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {METRIC_KEYS.map(([key, label]) => (
                          <tr key={key}>
                            <td>{label}</td>
                            {comparison.runs.map(run => (
                              <td key={run.run_id} className={`num ${selectionMetricClass(key, run.metrics?.[key])}`}>{metric(run, key)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    {overlapRows.length >= 1 ? (
                      <div className="ksq-chart">
                        <h4>命中重合分析（基准：v{picksList[0]!.version} · {picksList[0]!.trade_date || picksList[0]!.run_id.slice(7, 15)}）</h4>
                        <div className="ksq-table-wrap">
                        <table className="ksq-table">
                          <thead>
                            <tr>
                              <th>run</th>
                              <th>基准日</th>
                              <th>保留</th>
                              <th>新增</th>
                              <th>剔除</th>
                              <th>保留样例</th>
                              <th>新增样例</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overlapRows.map(row => (
                              <tr key={row.run.run_id}>
                                <td className="ksq-mono">v{row.run.version} · {row.run.run_id.slice(7, 15)}</td>
                                <td>{row.run.trade_date || '—'}</td>
                                <td className="num">{row.keptCount}</td>
                                <td className="num">{row.addedCount}</td>
                                <td className="num">{row.removedCount}</td>
                                <td className="ksq-mono ksq-cell-clip" title={row.keptSample.join('、') || undefined}>{row.keptSample.join('、') || '—'}</td>
                                <td className="ksq-mono ksq-cell-clip" title={row.addedSample.join('、') || undefined}>{row.addedSample.join('、') || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    ) : (
                      <p className="ksq-note">所选运行缺少命中清单数据（record_run 未存 picks），无法做重合分析。</p>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
      <CopyToast text={toast} />

      {pendingInterpret !== null && getAgentBridge() !== null && (
        <TaskTargetMenu
          taskKind="pick"
          title="个股解读发送到…"
          prompt={pendingInterpret}
          bridge={getAgentBridge()!}
          useWorkspaces={useWorkspaces}
          onClose={() => setPendingInterpret(null)}
        />
      )}
    </div>
  )
}
