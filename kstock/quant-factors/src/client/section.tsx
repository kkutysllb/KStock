/**
 * 因子库面板：列表 + 版本时间线 + 检验运行 + 跨版本对比（累计 IC 叠加）。
 * 移植自 1.x components/FactorsLibrary.tsx；重跑走复制提示词。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  compareFactorRuns,
  getFactorRunIcSeries,
  listFactors,
  listFactorRuns,
  listFactorVersions,
  type Factor,
  type FactorRunComparison,
  type FactorRunIcSeries,
  type FactorRunSummary,
  type FactorVersion,
} from '@kstock/quant-ui'
import { IconCopy, IconFlask, IconPlay } from '@kstock/quant-ui'
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
  statusBadge,
  useCopyPrompt,
} from '@kstock/quant-ui'

const CATEGORY_LABELS: Record<string, string> = {
  value: '价值',
  momentum: '动量',
  quality: '质量',
  low_vol: '低波动',
  size: '规模',
  growth: '成长',
  custom: '自定义',
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

/** IC/IR/多空差为正绿、负红；IC>0 占比按方向稳定性阈值。 */
function factorMetricClass(key: string, value: unknown): string {
  if (typeof value !== 'number') return ''
  if (key === 'ic_positive_pct') return value >= 55 ? 'ksq-up' : value < 50 ? 'ksq-down' : ''
  if (key === 'ic_mean' || key === 'ir' || key === 'long_short_spread_pct') {
    return value > 0 ? 'ksq-up' : value < 0 ? 'ksq-down' : ''
  }
  return ''
}

/** IC 序列归一化：兼容 [{date, ic}] 与数值数组，输出累计 IC（0 起点）。 */
function cumulativeIc(raw: FactorRunIcSeries['ic_series']): number[] {
  let values: number[] = []
  if (Array.isArray(raw)) {
    const asObjects = raw.every(item => typeof item === 'object' && item !== null && typeof (item as { ic?: unknown }).ic === 'number')
    if (asObjects) {
      values = (raw as Array<{ ic: number }>).map(item => item.ic)
    } else {
      values = (raw as unknown[]).filter((item): item is number => typeof item === 'number')
    }
  }
  const out: number[] = []
  let acc = 0
  for (const value of values) {
    acc += Number.isFinite(value) ? value : 0
    out.push(acc)
  }
  return out
}

const METRIC_KEYS = [
  ['ic_mean', 'IC 均值'],
  ['ir', 'IR'],
  ['ic_positive_pct', 'IC>0 占比 %'],
  ['long_short_spread_pct', '多空分层差 %'],
  ['n_periods', '检验期数'],
] as const

export function FactorsSection() {
  const [factors, setFactors] = useState<Factor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [versions, setVersions] = useState<FactorVersion[]>([])
  const [runs, setRuns] = useState<FactorRunSummary[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [comparison, setComparison] = useState<FactorRunComparison | null>(null)
  const [icSeries, setIcSeries] = useState<FactorRunIcSeries[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const { copy, toast } = useCopyPrompt()

  const reload = useCallback(async () => {
    setError(null)
    try {
      setFactors(await listFactors())
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载因子库失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const list = await listFactors()
      setFactors(list)
      if (selectedId) {
        const [versionList, runList] = await Promise.all([
          listFactorVersions(selectedId),
          listFactorRuns(selectedId),
        ])
        setVersions(versionList)
        setRuns(runList)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新因子库失败')
    } finally {
      setRefreshing(false)
    }
  }, [selectedId])

  const selected = factors.find(item => item.factor_id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId) return
    setDetailLoading(true)
    setCompareIds([])
    setComparison(null)
    setIcSeries([])
    setError(null)
    let active = true
    void (async () => {
      try {
        const [versionList, runList] = await Promise.all([
          listFactorVersions(selectedId),
          listFactorRuns(selectedId),
        ])
        if (!active) return
        setVersions(versionList)
        setRuns(runList)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '加载因子详情失败')
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
      setIcSeries([])
      return
    }
    let active = true
    void (async () => {
      try {
        const [result, ...curves] = await Promise.all([
          compareFactorRuns(selectedId, compareIds),
          ...compareIds.map(runId => getFactorRunIcSeries(selectedId, runId).catch(() => null)),
        ])
        if (!active) return
        setComparison(result)
        setIcSeries(curves.filter((item): item is FactorRunIcSeries => item !== null))
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : '对比加载失败')
      }
    })()
    return () => { active = false }
  }, [selectedId, compareIds])

  const rerunPrompt = (version: FactorVersion) =>
    `请重跑因子库中的「${selected?.name ?? ''}」（${selectedId}）：因子代码与参数采用 v${version.version} 版本` +
    `（change_note：${version.change_note || '无'}），股票池与检验配置参照该版本最近一次检验` +
    `（无历史记录则用中证 800 + 近 2 年月度调仓）。跑完后把结果入库：` +
    `POST /kstock-api/factors/${selectedId}/runs，version=${version.version}，` +
    `附 universe/config/metrics/ic_series/layers。`

  const icCurves = useMemo(
    () => icSeries.map((item, index) => ({
      label: `v${item.version}`,
      values: cumulativeIc(item.ic_series),
      color: RUN_COLORS[index % RUN_COLORS.length]!,
    })),
    [icSeries],
  )

  return (
    <div className="ksq-body" aria-label="因子库">
      <div className="ksq-toolbar">
        <span className="ksq-count"><IconFlask size={13} /> {factors.length} 个因子</span>
        <RefreshButton refreshing={refreshing} onClick={() => void refresh()} label="刷新因子库" />
      </div>
      {error && <ErrorLine message={error} />}
      {loading ? <Loading text="加载因子库…" /> : (
        <div className="ksq-split">
          <aside className="ksq-list">
            {factors.length === 0
              ? <p className="ksq-hint">暂无因子。在对话里让 agent 做「因子挖掘检验」并入库版本后，这里会出现因子资产。</p>
              : factors.map(factor => (
                <button
                  key={factor.factor_id}
                  type="button"
                  className={`ksq-list-item ${factor.factor_id === selectedId ? 'active' : ''}`}
                  onClick={() => setSelectedId(factor.factor_id)}
                >
                  <span className="ksq-item-name">
                    <span className={`ksq-dot tone-${statusBadge(factor.status).tone}`} aria-hidden="true" />
                    <span className="ksq-name-text">{factor.name}</span>
                  </span>
                  <span className="ksq-item-meta">
                    <span>{categoryLabel(factor.category)} · v{factor.current_version} · {statusBadge(factor.status).label}</span>
                    {factor.latest_run && typeof factor.latest_run.metrics?.ic_mean === 'number' && (
                      <span className={`ksq-chip ${factorMetricClass('ic_mean', factor.latest_run.metrics.ic_mean)}`}>
                        IC {metric(factor.latest_run, 'ic_mean')}
                      </span>
                    )}
                    {factor.latest_run && typeof factor.latest_run.metrics?.ir === 'number' && (
                      <span className={`ksq-chip ${factorMetricClass('ir', factor.latest_run.metrics.ir)}`}>
                        IR {metric(factor.latest_run, 'ir')}
                      </span>
                    )}
                  </span>
                </button>
              ))}
          </aside>

          <section className="ksq-detail">
            {!selected ? (
              <p className="ksq-hint">从左侧选择一个因子查看版本时间线与检验对比。</p>
            ) : detailLoading ? (
              <Loading text="加载因子详情…" />
            ) : (
              <>
                <header className="ksq-identity">
                  <div className="ksq-identity-head">
                    <h2>{selected.name}</h2>
                    <span className={`ksq-badge tone-${statusBadge(selected.status).tone}`}>{statusBadge(selected.status).label}</span>
                  </div>
                  <p className="ksq-hypothesis">{selected.hypothesis || '（未写因子逻辑假设）'}</p>
                  <p className="ksq-item-meta ksq-mono">
                    {selected.factor_id} · {categoryLabel(selected.category)} · 当前 v{selected.current_version} · 更新于 {formatDateTime(selected.updated_at)}
                  </p>
                </header>

                <div>
                  <h3 className="ksq-section-title"><IconFlask size={14} /> 版本时间线</h3>
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
                  <h3 className="ksq-section-title">检验运行（勾选 2-4 个对比）</h3>
                  {runs.length === 0 ? <p className="ksq-hint">尚无检验运行记录。</p> : (
                    <table className="ksq-table">
                      <thead>
                        <tr>
                          <th>对比</th>
                          <th>run</th>
                          <th>版本</th>
                          <th>股票池</th>
                          <th>区间</th>
                          <th>IC 均值</th>
                          <th>IR</th>
                          <th>IC&gt;0 %</th>
                          <th>多空差 %</th>
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
                            <td>{run.universe || '?'}</td>
                            <td>{run.data_start || '?'} ~ {run.data_end || '?'}</td>
                            <td className={`num ${factorMetricClass('ic_mean', run.metrics?.ic_mean)}`}>{metric(run, 'ic_mean')}</td>
                            <td className={`num ${factorMetricClass('ir', run.metrics?.ir)}`}>{metric(run, 'ir')}</td>
                            <td className={`num ${factorMetricClass('ic_positive_pct', run.metrics?.ic_positive_pct)}`}>{metric(run, 'ic_positive_pct')}</td>
                            <td className={`num ${factorMetricClass('long_short_spread_pct', run.metrics?.long_short_spread_pct)}`}>{metric(run, 'long_short_spread_pct')}</td>
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
                              <td key={run.run_id} className={`num ${factorMetricClass(key, run.metrics?.[key])}`}>{metric(run, key)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {icCurves.length >= 2 ? (
                      <div className="ksq-chart">
                        <h4>累计 IC 曲线叠加</h4>
                        <LineOverlay series={icCurves} baseline={0} title="版本累计 IC 曲线叠加对比" />
                      </div>
                    ) : (
                      <p className="ksq-note">所选运行缺少 IC 序列数据（record_run 未存 ic_series），无法叠加曲线。</p>
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
