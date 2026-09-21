/**
 * 策略库面板：列表 + 版本时间线 + 回测运行 + 跨版本对比（净值叠加）。
 * 移植自 1.x components/StrategiesLibrary.tsx；「重跑本版本」由预填
 * 输入框改为复制提示词（引擎 UI 的对话输入框不归本插件管）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  compareStrategyRuns,
  fetchReportHtml,
  getStrategyRunEquity,
  getStrategyRunTrades,
  listStrategies,
  listStrategyRuns,
  listStrategyVersions,
  reportBlobUrl,
  type Strategy,
  type StrategyEquity,
  type StrategyRunComparison,
  type StrategyRunSummary,
  type StrategyRunTrades,
  type StrategyVersion,
} from '@kstock/quant-ui'
import { IconCopy, IconGitBranch, IconPlay } from '@kstock/quant-ui'
import {
  CopyToast,
  DrawdownChart,
  Empty,
  ErrorLine,
  LineOverlay,
  Loading,
  PnlBars,
  PreviewDialog,
  RefreshButton,
  RUN_COLORS,
  TaskTargetMenu,
  formatDateTime,
  metric,
  metricClass,
  statusBadge,
  useCopyPrompt,
  type UseWorkspaces,
} from '@kstock/quant-ui'
import { getAgentBridge, interpretStrategyPrompt } from './agent.ts'

/** 净值数据归一化：兼容 [{date,equity}] 与 {dates,values} 形态，统一为 1 起点。 */
function normalizeEquity(raw: StrategyEquity['equity']): number[] {
  let values: number[] = []
  if (Array.isArray(raw)) {
    const asObjects = raw.every(item => typeof item === 'object' && item !== null && typeof (item as { equity?: unknown }).equity === 'number')
    if (asObjects) {
      values = (raw as Array<{ equity: number }>).map(item => item.equity)
    } else {
      values = (raw as unknown[]).filter((item): item is number => typeof item === 'number')
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as { dates?: unknown; values?: unknown; equity_values?: unknown }
    const candidate = Array.isArray(record.values) ? record.values : record.equity_values
    if (Array.isArray(candidate)) values = candidate.filter((v): v is number => typeof v === 'number')
  }
  const base = values[0]
  if (!Number.isFinite(base) || base! <= 0) return values
  return values.map(value => value / base!)
}

const METRIC_KEYS = [
  ['total_return_pct', '总收益 %'],
  ['annual_return_pct', '年化 %'],
  ['sharpe_ratio', '夏普'],
  ['max_drawdown_pct', '最大回撤 %'],
  ['win_rate_pct', '胜率 %'],
  ['trade_count', '交易次数'],
] as const

/** 空态引导：让 agent 把最近一次策略回测结果归档进策略库的复制提示词。 */
const INGEST_PROMPT =
  '请把本工作区最近一次策略回测任务的结果归档进 KStock 策略库（引擎 http://127.0.0.1:18001，不可达则跳过并明说）。三步：' +
  '1) POST /kstock-api/strategies，body {name: 策略名, hypothesis: 一句话策略逻辑假设}；' +
  '2) POST /kstock-api/strategies/{strategy_id}/versions，body {code: 策略信号/回测核心代码全文, params: 参数 JSON, change_note}；' +
  '3) POST /kstock-api/strategies/{strategy_id}/runs，body {version, data_start, data_end, rules: {universe, benchmark, report_id 报告库看板链}, ' +
  'metrics: {total_return_pct, annual_return_pct, sharpe_ratio, max_drawdown_pct, win_rate_pct, trade_count}, equity: 净值序列 JSON, trades: 交易清单 JSON}。' +
  '多策略对比研究则每策略独立建资产，禁止整体跳过。数据取自工作区 data/ 与 reports/ 下的真实产物，禁止编造。'

/** run 的 rules.report_id（阶段五看板建链）。 */
function runReportId(run: StrategyRunSummary | undefined): string | null {
  const value = run?.rules?.report_id
  return typeof value === 'string' && value !== '' ? value : null
}

/** trades 附件归一：宽松 unknown → 平仓盈亏序列 + 摘要（防御式）。 */
function tradesDigest(raw: unknown): {
  pnlSeries: number[]
  total: number
  closes: number
  maxWin: number
  maxLoss: number
  totalPnl: number
} {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as { trades?: unknown }).trades)
      ? (raw as { trades: unknown[] }).trades
      : []
  const rows = list.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
  const pnl = rows
    .map(row => (typeof row.realized_pnl === 'number' && Number.isFinite(row.realized_pnl) ? row.realized_pnl : null))
    .filter((value): value is number => value !== null && value !== 0)
  return {
    pnlSeries: pnl,
    total: rows.length,
    closes: pnl.length,
    maxWin: pnl.length > 0 ? Math.max(...pnl) : 0,
    maxLoss: pnl.length > 0 ? Math.min(...pnl) : 0,
    totalPnl: pnl.reduce((sum, value) => sum + value, 0),
  }
}

export function StrategiesSection({ useWorkspaces }: { useWorkspaces?: UseWorkspaces } = {}) {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [versions, setVersions] = useState<StrategyVersion[]>([])
  const [runs, setRuns] = useState<StrategyRunSummary[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [comparison, setComparison] = useState<StrategyRunComparison | null>(null)
  const [equities, setEquities] = useState<StrategyEquity[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [reportView, setReportView] = useState<{ runId: string; htmlUrl: string } | null>(null)
  const [pendingInterpret, setPendingInterpret] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<{ runId: string; equity: StrategyEquity | null; trades: StrategyRunTrades | null } | null>(null)
  const { copy, toast } = useCopyPrompt()

  const reload = useCallback(async () => {
    setError(null)
    try {
      setStrategies(await listStrategies())
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载策略库失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  /** 列表 + 选中策略的版本/回测详情一起重拉（agent 刚入库新 run 时靠它看到）。 */
  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const list = await listStrategies()
      setStrategies(list)
      if (selectedId) {
        const [versionList, runList] = await Promise.all([
          listStrategyVersions(selectedId),
          listStrategyRuns(selectedId),
        ])
        setVersions(versionList)
        setRuns(runList)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新策略库失败')
    } finally {
      setRefreshing(false)
    }
  }, [selectedId])

  const selected = strategies.find(item => item.strategy_id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId) return
    setDetailLoading(true)
    setCompareIds([])
    setComparison(null)
    setEquities([])
    closeReportView()
    setPendingInterpret(null)
    setDetailView(null)
    setError(null)
    let active = true
    void (async () => {
      try {
        const [versionList, runList] = await Promise.all([
          listStrategyVersions(selectedId),
          listStrategyRuns(selectedId),
        ])
        if (!active) return
        setVersions(versionList)
        setRuns(runList)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '加载策略详情失败')
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
      setEquities([])
      return
    }
    let active = true
    void (async () => {
      try {
        const [result, ...curves] = await Promise.all([
          compareStrategyRuns(selectedId, compareIds),
          ...compareIds.map(runId => getStrategyRunEquity(selectedId, runId).catch(() => null)),
        ])
        if (!active) return
        setComparison(result)
        setEquities(curves.filter((item): item is StrategyEquity => item !== null))
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '对比加载失败')
      }
    })()
    return () => { active = false }
  }, [selectedId, compareIds])

  /** 重跑提示词：新体系无 KStock MCP 工具，改为引导 agent 经 /kstock-api 入库。 */
  const rerunPrompt = (version: StrategyVersion) =>
    `请重跑策略库中的「${selected?.name ?? ''}」（${selectedId}）：策略代码与参数采用 v${version.version} 版本` +
    `（change_note：${version.change_note || '无'}），数据区间与交易规则参照该版本最近一次回测` +
    `（无历史记录则用近 2 年日线 + 默认 A 股规则）。跑完后把结果入库：` +
    `POST /kstock-api/strategies/${selectedId}/runs，version=${version.version}，` +
    `附 data_start/data_end/rules（含 report_id 看板链）/metrics` +
    `（total_return_pct/annual_return_pct/sharpe_ratio/max_drawdown_pct/win_rate_pct/trade_count）/equity/trades。`

  /** 关闭报告视图并释放 blob URL。 */
  const closeReportView = useCallback(() => {
    setReportView(current => {
      if (current?.htmlUrl) URL.revokeObjectURL(current.htmlUrl)
      return null
    })
  }, [])

  /** 看板直嵌（rules.report_id → 报告库 HTML iframe），无链明示。 */
  const showReport = useCallback(async (runId: string) => {
    if (reportView?.runId === runId) {
      closeReportView()
      return
    }
    const run = runs.find(item => item.run_id === runId)
    const reportId = runReportId(run)
    closeReportView()
    if (reportId === null) {
      setError('该 run 未链接报告看板（rules 缺 report_id）')
      return
    }
    try {
      const html = await fetchReportHtml(reportId)
      setReportView({ runId, htmlUrl: reportBlobUrl(html) })
    } catch {
      setError('看板加载失败（报告可能已删除）')
    }
  }, [reportView, runs, closeReportView])

  /** 展开单 run 回测详情（L1+L2）：净值 + 回撤副图 + 盈亏柱 + 摘要。 */
  const toggleDetail = useCallback(async (runId: string) => {
    if (!selectedId) return
    if (detailView?.runId === runId) {
      setDetailView(null)
      return
    }
    setDetailView({ runId, equity: null, trades: null })
    const [equity, trades] = await Promise.all([
      getStrategyRunEquity(selectedId, runId).catch(() => null),
      getStrategyRunTrades(selectedId, runId).catch(() => null),
    ])
    setDetailView({ runId, equity, trades })
  }, [selectedId, detailView])

  /** 回测「解读」（§28）：先弹目标选择菜单（strategy 类型记忆）。 */
  const askInterpret = useCallback((run: StrategyRunSummary) => {
    if (selected === null) return
    if (getAgentBridge() === null) {
      setError('会话联动不可用（sessions/layout 服务缺席）')
      return
    }
    const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
    setPendingInterpret(interpretStrategyPrompt({
      strategyName: selected.name,
      hypothesis: selected.hypothesis,
      version: run.version,
      range: run.data_start !== '' && run.data_end !== '' ? `${run.data_start} ~ ${run.data_end}` : '',
      totalReturnPct: num(run.metrics?.total_return_pct),
      annualReturnPct: num(run.metrics?.annual_return_pct),
      sharpe: num(run.metrics?.sharpe_ratio),
      maxDrawdownPct: num(run.metrics?.max_drawdown_pct),
      winRatePct: num(run.metrics?.win_rate_pct),
      tradeCount: num(run.metrics?.trade_count),
    }))
  }, [selected])

  const equitySeries = useMemo(
    () => equities.map((item, index) => ({
      label: `v${item.version}`,
      values: normalizeEquity(item.equity),
      color: RUN_COLORS[index % RUN_COLORS.length]!,
    })),
    [equities],
  )

  return (
    <div className="ksq-body" aria-label="策略库">
      <div className="ksq-toolbar">
        <span className="ksq-count"><IconGitBranch size={13} /> {strategies.length} 个策略</span>
        <RefreshButton refreshing={refreshing} onClick={() => void refresh()} label="刷新策略库" />
      </div>
      {error && <ErrorLine message={error} />}
      {loading ? <Loading text="加载策略库…" /> : (
        <div className="ksq-split">
          <aside className="ksq-list">
            {strategies.length === 0
              ? <p className="ksq-hint">暂无策略。用右侧提示词把最近一次回测结果入库。</p>
              : strategies.map(strategy => (
                <button
                  key={strategy.strategy_id}
                  type="button"
                  className={`ksq-list-item ${strategy.strategy_id === selectedId ? 'active' : ''}`}
                  onClick={() => setSelectedId(strategy.strategy_id)}
                >
                  <span className="ksq-item-name">
                    <span className={`ksq-dot tone-${statusBadge(strategy.status).tone}`} aria-hidden="true" />
                    <span className="ksq-name-text">{strategy.name}</span>
                  </span>
                  <span className="ksq-item-meta">
                    <span>v{strategy.current_version} · {statusBadge(strategy.status).label}</span>
                    {strategy.latest_run && typeof strategy.latest_run.metrics?.total_return_pct === 'number' && (
                      <span className={`ksq-chip ${metricClass('total_return_pct', strategy.latest_run.metrics.total_return_pct)}`}>
                        收益 {metric(strategy.latest_run, 'total_return_pct')}%
                      </span>
                    )}
                    {strategy.latest_run && typeof strategy.latest_run.metrics?.max_drawdown_pct === 'number' && (
                      <span className={`ksq-chip ${metricClass('max_drawdown_pct', strategy.latest_run.metrics.max_drawdown_pct)}`}>
                        回撤 {metric(strategy.latest_run, 'max_drawdown_pct')}%
                      </span>
                    )}
                  </span>
                </button>
              ))}
          </aside>

          <section className="ksq-detail">
            {!selected ? (
              strategies.length === 0 ? (
                <div className="ksq-empty">
                  <strong>策略库还是空的</strong>
                  <p>策略回测任务的产物目前只落在工作区文件（data/ 与 reports/）里。归档进策略库后，这里会出现可回看净值叠加、跨版本对比、重跑的策略资产。</p>
                  <button className="ksq-linkbtn" type="button" onClick={() => copy(INGEST_PROMPT)}>
                    <IconCopy size={11} /> 复制「把最近一次回测结果入库」提示词
                  </button>
                  <p className="ksq-item-meta">粘贴到对话发送即可；后续回测任务会按 strategy-backtest-theme 阶段五自动归档。</p>
                </div>
              ) : (
                <p className="ksq-hint">从左侧选择一个策略查看版本时间线与回测对比。</p>
              )
            ) : detailLoading ? (
              <Loading text="加载策略详情…" />
            ) : (
              <>
                <header className="ksq-identity">
                  <div className="ksq-identity-head">
                    <h2>{selected.name}</h2>
                    <span className={`ksq-badge tone-${statusBadge(selected.status).tone}`}>{statusBadge(selected.status).label}</span>
                  </div>
                  <p className="ksq-hypothesis">{selected.hypothesis || '（未写投资假设）'}</p>
                  <p className="ksq-item-meta ksq-mono">
                    {selected.strategy_id} · 当前 v{selected.current_version} · 更新于 {formatDateTime(selected.updated_at)}
                  </p>
                </header>

                <div>
                  <h3 className="ksq-section-title"><IconGitBranch size={14} /> 版本时间线</h3>
                  <div className="ksq-versions">
                    {versions.length === 0 ? <p className="ksq-hint">尚无版本。</p> : versions
                      .slice()
                      .reverse()
                      .map(version => (
                        <div
                          key={version.version}
                          className={`ksq-version ${version.version === selected.current_version ? 'latest' : ''}`}
                        >
                          <div className="ksq-version-head">
                            <strong>v{version.version}</strong>
                            {version.version === selected.current_version && <span className="ksq-badge tone-live">最新</span>}
                            <span className="ksq-item-meta">
                              {formatDateTime(version.created_at)} · {Math.round(version.code_bytes / 1024)}KB · sha {version.code_sha256.slice(0, 8)}
                            </span>
                          </div>
                          <p className="ksq-version-note">{version.change_note || '（无变更说明）'}</p>
                          <button className="ksq-linkbtn" type="button" onClick={() => copy(rerunPrompt(version))}>
                            <IconPlay size={11} /> <IconCopy size={11} /> 复制重跑提示词
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h3 className="ksq-section-title">回测运行（勾选 2-4 个对比）</h3>
                  {runs.length === 0 ? <p className="ksq-hint">尚无回测运行记录。</p> : (
                    <table className="ksq-table">
                      <thead>
                        <tr>
                          <th>对比</th>
                          <th>run</th>
                          <th>版本</th>
                          <th>区间</th>
                          <th>总收益 %</th>
                          <th>夏普</th>
                          <th>回撤 %</th>
                          <th>交易</th>
                          <th>时间</th>
                          <th>详情 / 看板 / 解读</th>
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
                            <td className="ksq-mono" title={run.run_id}>{run.run_id.slice(5, 13)}</td>
                            <td>v{run.version}</td>
                            <td>{run.data_start || '?'} ~ {run.data_end || '?'}</td>
                            <td className={`num ${metricClass('total_return_pct', run.metrics?.total_return_pct)}`}>{metric(run, 'total_return_pct')}</td>
                            <td className={`num ${metricClass('sharpe_ratio', run.metrics?.sharpe_ratio)}`}>{metric(run, 'sharpe_ratio')}</td>
                            <td className={`num ${metricClass('max_drawdown_pct', run.metrics?.max_drawdown_pct)}`}>{metric(run, 'max_drawdown_pct')}</td>
                            <td className="num">{metric(run, 'trade_count')}</td>
                            <td>{formatDateTime(run.created_at)}</td>
                            <td>
                              <button className="ksq-linkbtn" type="button" onClick={() => void toggleDetail(run.run_id)}>
                                {detailView?.runId === run.run_id ? '收起' : '详情'}
                              </button>
                              {runReportId(run) !== null && (
                                <>
                                  {' '}
                                  <button className="ksq-linkbtn" type="button" onClick={() => void showReport(run.run_id)}>
                                    {reportView?.runId === run.run_id ? '收起' : '看板'}
                                  </button>
                                </>
                              )}
                              {' '}
                              <button className="ksq-linkbtn" type="button" onClick={() => askInterpret(run)}>解读</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {detailView !== null && (() => {
                  const run = runs.find(item => item.run_id === detailView.runId)
                  if (run === undefined) return null
                  const nav = normalizeEquity(detailView.equity?.equity ?? [])
                  const digest = tradesDigest(detailView.trades?.trades)
                  const range = run.data_start !== '' && run.data_end !== '' ? `${run.data_start} ~ ${run.data_end}` : '—'
                  return (
                    <div className="ksq-compare">
                      <h3>
                        回测详情（{run.run_id.slice(5, 13)} · v{run.version} · {range}）
                        <button className="ksq-linkbtn" type="button" onClick={() => setDetailView(null)}>收起</button>
                      </h3>
                      <table className="ksq-table">
                        <tbody>
                          <tr>
                            {METRIC_KEYS.map(([key, label]) => (
                              <td key={key}>{label}：<strong className={`num ${metricClass(key, run.metrics?.[key])}`}>{metric(run, key)}</strong></td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                      {nav.length >= 2 ? (
                        <>
                          <div className="ksq-chart">
                            <h4>策略净值（归一化，1 起点）</h4>
                            <LineOverlay
                              series={[{ label: `v${run.version} 净值`, values: nav, color: RUN_COLORS[0]! }]}
                              baseline={1}
                              title="策略净值曲线"
                            />
                          </div>
                          <div className="ksq-chart">
                            <h4>回撤（underwater）</h4>
                            <DrawdownChart values={nav} title="回撤副图" />
                          </div>
                        </>
                      ) : (
                        <p className="ksq-note">该 run 未存净值附件（record_run 未附 equity），无法绘制曲线。</p>
                      )}
                      {digest.pnlSeries.length >= 2 ? (
                        <>
                          <div className="ksq-chart">
                            <h4>每笔平仓盈亏</h4>
                            <PnlBars values={digest.pnlSeries} title="每笔平仓盈亏柱" />
                          </div>
                          <p className="ksq-item-meta">
                            交易 {digest.total} 笔 · 平仓 {digest.closes} 笔 · 单笔最大盈 {digest.maxWin.toLocaleString()} / 亏 {digest.maxLoss.toLocaleString()} · 累计已实现 {digest.totalPnl.toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <p className="ksq-note">该 run 未存交易清单附件（record_run 未附 trades），无法绘制盈亏分布。</p>
                      )}
                    </div>
                  )
                })()}

                {comparison && (
                  <div className="ksq-compare">
                    <h3>版本对比{comparison.comparable ? '（同口径，可严格对比）' : '（口径不一致，仅供参考）'}</h3>
                    {!comparison.comparable && comparison.notes.map(note => <p key={note} className="ksq-note">{note}</p>)}
                    <table className="ksq-table">
                      <thead>
                        <tr>
                          <th>指标</th>
                          {comparison.runs.map(run => (
                            <th key={run.run_id} className="ksq-mono">v{run.version} · {run.run_id.slice(5, 13)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {METRIC_KEYS.map(([key, label]) => (
                          <tr key={key}>
                            <td>{label}</td>
                            {comparison.runs.map(run => (
                              <td key={run.run_id} className={`num ${metricClass(key, run.metrics?.[key])}`}>{metric(run, key)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {equitySeries.length >= 2 ? (
                      <div className="ksq-chart">
                        <h4>净值曲线叠加（归一化）</h4>
                        <LineOverlay series={equitySeries} baseline={1} title="版本净值曲线叠加对比" />
                      </div>
                    ) : (
                      <p className="ksq-note">所选运行缺少净值数据（record_run 未存 equity），无法叠加曲线。</p>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
      {reportView !== null && (
        <PreviewDialog title="策略回测看板" onClose={closeReportView}>
          <iframe title="策略回测看板" src={reportView.htmlUrl} sandbox="allow-scripts" />
        </PreviewDialog>
      )}

      {pendingInterpret !== null && getAgentBridge() !== null && (
        <TaskTargetMenu
          taskKind="strategy"
          title="策略解读发送到…"
          prompt={pendingInterpret}
          bridge={getAgentBridge()!}
          useWorkspaces={useWorkspaces}
          onClose={() => setPendingInterpret(null)}
        />
      )}
      <CopyToast text={toast} />
    </div>
  )
}
