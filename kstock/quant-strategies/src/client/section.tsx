/**
 * 策略库面板：列表 + 版本时间线 + 回测运行 + 跨版本对比（净值叠加）。
 * 移植自 1.x components/StrategiesLibrary.tsx；「重跑本版本」由预填
 * 输入框改为复制提示词（引擎 UI 的对话输入框不归本插件管）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  compareStrategyRuns,
  getStrategyRunEquity,
  listStrategies,
  listStrategyRuns,
  listStrategyVersions,
  type Strategy,
  type StrategyEquity,
  type StrategyRunComparison,
  type StrategyRunSummary,
  type StrategyVersion,
} from '@kstock/quant-ui'
import { IconCopy, IconGitBranch, IconPlay } from '@kstock/quant-ui'
import {
  CopyToast,
  Empty,
  ErrorLine,
  LineOverlay,
  Loading,
  RefreshButton,
  RUN_COLORS,
  formatDateTime,
  metric,
  metricClass,
  statusBadge,
  useCopyPrompt,
} from '@kstock/quant-ui'

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

export function StrategiesSection() {
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
    `附 data_start/data_end/rules/metrics/equity。`

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
              ? <p className="ksq-hint">暂无策略。在对话里让 agent 做「策略研究回测」并入库版本后，这里会出现策略资产。</p>
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
              <p className="ksq-hint">从左侧选择一个策略查看版本时间线与回测对比。</p>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

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
      <CopyToast text={toast} />
    </div>
  )
}
