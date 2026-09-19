/**
 * 选股库面板：方案列表 + 要求版本时间线 + 运行归档（报告查看）+
 * 跨期命中对比（重合分析）。移植自 1.x components/SelectionsLibrary.tsx。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  compareSelectionRuns,
  getSelectionRunPicks,
  getSelectionRunReport,
  listSelectionRuns,
  listSelectionVersions,
  listSelections,
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
  RefreshButton,
  formatDateTime,
  metric,
  statusBadge,
  useCopyPrompt,
} from '@kstock/quant-ui'

/** 共振股数 > 0 绿。 */
function selectionMetricClass(key: string, value: unknown): string {
  if (typeof value !== 'number') return ''
  if (key === 'consensus_count') return value > 0 ? 'ksq-up' : ''
  return ''
}

function criteriaSummary(version: SelectionVersion): string {
  const summary = version.criteria?.summary
  if (typeof summary === 'string' && summary.trim()) return summary
  const keys = Object.keys(version.criteria ?? {})
  return keys.length > 0 ? `（口径字段：${keys.join(' / ')}）` : '（空口径）'
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

export function SelectionsSection() {
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
  const [reportView, setReportView] = useState<{ runId: string; text: string } | null>(null)
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

  useEffect(() => {
    if (!selectedId) return
    setDetailLoading(true)
    setCompareIds([])
    setComparison(null)
    setPicksList([])
    setReportView(null)
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
      setReportView(null)
      return
    }
    try {
      const detail = await getSelectionRunReport(selectedId, runId)
      setReportView({ runId, text: detail.report })
    } catch (err) {
      setError(err instanceof Error ? err.message : '报告加载失败')
    }
  }, [selectedId, reportView])

  const rerunPrompt = (version: SelectionVersion) =>
    `请重跑选股库中的「${selected?.name ?? ''}」（${selectedId}）：选股口径采用 v${version.version} 版本` +
    `（${criteriaSummary(version)}），股票池与执行口径与该版本最近一次 run 保持一致` +
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
              ? <p className="ksq-hint">暂无方案。在对话里让 agent 做选股并把要求入库后，这里会出现方案资产。</p>
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
              <p className="ksq-hint">从左侧选择一个方案查看要求时间线与运行归档。</p>
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
                      .map(version => (
                        <div
                          key={version.version}
                          className={`ksq-version ${version.version === selected.current_version ? 'latest' : ''}`}
                        >
                          <div className="ksq-version-head">
                            <strong>v{version.version}</strong>
                            {version.version === selected.current_version && <span className="ksq-badge tone-live">最新</span>}
                            <span className="ksq-item-meta">{formatDateTime(version.created_at)}</span>
                          </div>
                          <p className="ksq-version-note">{criteriaSummary(version)}</p>
                          <p className="ksq-item-meta">{version.change_note || '（无变更说明）'}</p>
                          <button className="ksq-linkbtn" type="button" onClick={() => copy(rerunPrompt(version))}>
                            <IconPlay size={11} /> <IconCopy size={11} /> 复制重跑提示词
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h3 className="ksq-section-title">运行归档（勾选 2-4 个对比）</h3>
                  {runs.length === 0 ? <p className="ksq-hint">尚无运行归档。</p> : (
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
                          <th>报告</th>
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
                            <td>{run.universe || '—'}</td>
                            <td className="num">{metric(run, 'hit_count')}</td>
                            <td className={`num ${selectionMetricClass('consensus_count', run.metrics?.consensus_count)}`}>{metric(run, 'consensus_count')}</td>
                            <td className="num">{metric(run, 'top_n')}</td>
                            <td>{formatDateTime(run.created_at)}</td>
                            <td>
                              {run.report_path ? (
                                <button className="ksq-linkbtn" type="button" onClick={() => void showReport(run.run_id)}>
                                  {reportView?.runId === run.run_id ? '收起' : '查看'}
                                </button>
                              ) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {reportView && (
                  <div className="ksq-compare">
                    <h3>运行报告（{reportView.runId.slice(7, 15)}）</h3>
                    <pre className="ksq-criteria" style={{ maxHeight: 320 }}>{reportView.text}</pre>
                  </div>
                )}

                {comparison && (
                  <div className="ksq-compare">
                    <h3>运行对比{comparison.comparable ? '（同口径，可严格对比）' : '（口径不一致，仅供参考）'}</h3>
                    {!comparison.comparable && comparison.notes.map(note => <p key={note} className="ksq-note">{note}</p>)}
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
                    {overlapRows.length >= 1 ? (
                      <div className="ksq-chart">
                        <h4>命中重合分析（基准：v{picksList[0]!.version} · {picksList[0]!.trade_date || picksList[0]!.run_id.slice(7, 15)}）</h4>
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
                                <td className="ksq-mono">{row.keptSample.join('、') || '—'}</td>
                                <td className="ksq-mono">{row.addedSample.join('、') || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
    </div>
  )
}
