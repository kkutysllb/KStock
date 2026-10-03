/**
 * 因子库面板：列表 + 版本时间线 + 检验运行 + 跨版本对比（累计 IC 叠加）。
 * 移植自 1.x components/FactorsLibrary.tsx；重跑走复制提示词。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  compareFactorRuns,
  fetchReportHtml,
  getFactorRunIcSeries,
  getFactorRunLayers,
  listFactors,
  listFactorRuns,
  listFactorVersions,
  reportBlobUrl,
  type Factor,
  type FactorRunComparison,
  type FactorRunIcSeries,
  type FactorRunLayers,
  type FactorRunSummary,
  type FactorVersion,
  type OverlaySeries,
} from '@kstock/quant-ui'
import { IconCopy, IconFlask, IconPlay } from '@kstock/quant-ui'
import {
  CopyToast,
  ErrorLine,
  LineOverlay,
  Loading,
  PreviewDialog,
  RefreshButton,
  RUN_COLORS,
  TaskTargetMenu,
  formatDateTime,
  metric,
  statusBadge,
  useCopyPrompt,
  type UseWorkspaces,
} from '@kstock/quant-ui'
import { getAgentBridge, interpretFactorPrompt, buildFactorIteratePrompt, FACTOR_ITERATE_DIRECTIONS } from './agent.ts'

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

/** 空态引导：让 agent 把最近一次因子检验结果归档进因子库的复制提示词。 */
const INGEST_PROMPT =
  '请把本工作区最近一次因子检验任务的结果归档进 KStock 因子库（引擎 http://127.0.0.1:18001，不可达则跳过并明说）。三步：' +
  '1) POST /kstock-api/factors，body {name: 因子名, hypothesis: 一句话逻辑假设, category: value/momentum/quality/low_vol/size/growth/custom 之一}；' +
  '2) POST /kstock-api/factors/{factor_id}/versions，body {code: 因子构造代码全文, params: 窗口/分组参数 JSON, change_note}；' +
  '3) POST /kstock-api/factors/{factor_id}/runs，body {version, universe: 股票池, config: {n_groups, data_start, data_end, report_id 报告库看板链}, ' +
  'metrics: {ic_mean, ir, ic_positive_pct, long_short_spread_pct, n_periods}, ic_series: IC 序列 JSON, layers: 分层数据 JSON}。' +
  '数据取自工作区 data/ 与 reports/ 下的真实产物，禁止编造。'

/** run 的 config.report_id（阶段五看板建链；有则「看板」直嵌 HTML）。 */
function runReportId(run: FactorRunSummary | undefined): string | null {
  const value = run?.config?.report_id
  return typeof value === 'string' && value !== '' ? value : null
}

/** 区间展示：列值优先，回落 config（当前表结构无此列）。 */
function runRange(run: FactorRunSummary): string {
  const start = run.data_start ?? (typeof run.config?.data_start === 'string' ? run.config.data_start : '')
  const end = run.data_end ?? (typeof run.config?.data_end === 'string' ? run.config.data_end : '')
  return start || end ? `${start || '?'} ~ ${end || '?'}` : '—'
}

/** 序列值提取：number[] / {value|nav|equity|ret}[] → number[]。 */
function toNumbers(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(item => {
    if (typeof item === 'number' && Number.isFinite(item)) return [item]
    if (typeof item === 'object' && item !== null) {
      const record = item as Record<string, unknown>
      for (const key of ['value', 'nav', 'equity', 'ret', 'ic']) {
        const value = record[key]
        if (typeof value === 'number' && Number.isFinite(value)) return [value]
      }
    }
    return []
  })
}

/**
 * 分层附件归一（agent 自由形状 → 图表序列）：支持引擎原生产出
 * （factor-research analyze：{dates, group_nav: {group_1..n}, ls_nav}）、
 * {groups:{G1:[...]}, long_short:[...]}、{G1:[...],多空:[...]}、
 * [{label|group|name:'G1', values|equity|nav:[...]}] 四形态；值兼容
 * number[] 与 {date,value|nav|equity}[]。返回 G 序在前、多空压轴红。
 */
/** 序列容器键（值为 {名字: 序列} 的都算）。 */
const LAYER_CONTAINER_KEYS = ['group_nav', 'groups', 'layers', 'group_returns', 'group_equity']
/** 多空序列键/标签识别。 */
const LS_LABEL = /多空|long.?short|^ls(_nav|_returns)?$|^ls$/i

/** 标签归一：group_1/G1/第1组 → G1；ls_nav/long_short → 多空（统一展示）。 */
function normalizeLayerLabel(label: string): string {
  if (LS_LABEL.test(label)) return '多空'
  const match = label.match(/(?:group[_\s-]?|^G\s*|第\s*)(\d+)/i)
  if (match !== null) return `G${Number(match[1])}`
  return label
}

function layersToSeries(raw: unknown): OverlaySeries[] {
  let entries: Array<[string, unknown]> = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== 'object' || item === null) continue
      const record = item as Record<string, unknown>
      const label = ['label', 'group', 'name', 'layer'].find(key => typeof record[key] === 'string')
      const values = ['values', 'equity', 'nav', 'series', 'cum'].find(key => record[key] !== undefined)
      if (label !== undefined && values !== undefined) entries.push([String(record[label]), record[values]])
    }
  } else if (typeof raw === 'object' && raw !== null) {
    const record = raw as Record<string, unknown>
    // 序列容器键（group_nav/groups/layers/...）先解一层；其余顶层键
    // （ls_nav/多空 等平级序列）照收——不能因容器命中而丢弃。
    for (const containerKey of LAYER_CONTAINER_KEYS) {
      const inner = record[containerKey]
      if (typeof inner === 'object' && inner !== null && !Array.isArray(inner)) {
        entries.push(...Object.entries(inner as Record<string, unknown>))
      }
    }
    for (const [key, value] of Object.entries(record)) {
      if (LAYER_CONTAINER_KEYS.includes(key)) continue
      // 引擎原生键：ls_nav（number[]）识别为多空；dates/n_groups/final
      // 等非序列键由 toNumbers 自然滤空。
      entries.push([key, value])
    }
  }
  const series = entries
    .map(([label, values]) => ({ label: normalizeLayerLabel(label), values: toNumbers(values) }))
    .filter(item => item.values.length >= 2)
  // 排序：G 组按数字序在前（G10 排 G2 后）；多空/long_short/ls 压轴。
  const groupOrder = (label: string): number => {
    if (LS_LABEL.test(label)) return 99
    const match = label.match(/^G\s*(\d+)$/i)
    if (match !== null) return Number(match[1])
    return 50
  }
  return series
    .sort((a, b) => groupOrder(a.label) - groupOrder(b.label))
    .map((item, index) => ({
      ...item,
      color: groupOrder(item.label) === 99 ? '#e64646' : RUN_COLORS[index % RUN_COLORS.length]!,
    }))
}

/**
 * 跨因子概览（F3）：全库因子按 latest run 的 IC 均值排序的零轴双向横条
 * （正右绿 / 负左红，IR 数值随行），点击条联动选中该因子。≥2 个有
 * 检验指标的因子才显示（单因子无横向意义）。
 */
function FactorsOverview({ factors, selectedId, onSelect }: {
  factors: Factor[]
  selectedId: string | null
  onSelect: (id: string) => void
}): React.ReactElement | null {
  const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null
  const rows = factors
    .map(factor => ({
      id: factor.factor_id,
      name: factor.name,
      category: factor.category,
      ic: num(factor.latest_run?.metrics?.ic_mean),
      ir: num(factor.latest_run?.metrics?.ir),
    }))
    .filter((row): row is { id: string; name: string; category: string; ic: number; ir: number | null } => row.ic !== null)
    .sort((a, b) => b.ic - a.ic)
  if (rows.length < 2) return null
  const max = Math.max(...rows.map(row => Math.abs(row.ic)), 0.0001)
  return (
    <div className="ksq-factors-overview" aria-label="跨因子概览">
      <span className="ksq-trend-label">IC 均值排行</span>
      <div className="ksq-fo-rows">
        {rows.map(row => {
          const width = Math.round(Math.abs(row.ic) / max * 50)
          const positive = row.ic >= 0
          return (
            <button
              key={row.id}
              type="button"
              className={`ksq-fo-row ${row.id === selectedId ? 'active' : ''}`}
              onClick={() => onSelect(row.id)}
              title={`${row.name}（${categoryLabel(row.category)}）· IC ${row.ic.toFixed(4)}${row.ir !== null ? ` · IR ${row.ir.toFixed(2)}` : ''}——点击查看该因子`}
            >
              <span className="ksq-fo-name">{row.name}</span>
              <span className="ksq-fo-bar">
                <span className={`ksq-fo-fill ${positive ? 'up' : 'down'}`} style={{ [positive ? 'left' : 'right']: '50%', width: `${width}%` }} />
              </span>
              <span className={`ksq-fo-value ${positive ? 'ksq-up' : 'ksq-down'}`}>{row.ic.toFixed(4)}</span>
              <span className="ksq-fo-ir">{row.ir !== null ? `IR ${row.ir.toFixed(2)}` : ''}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function FactorsSection({ useWorkspaces }: { useWorkspaces?: UseWorkspaces } = {}) {
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
  const [detailView, setDetailView] = useState<{ runId: string; ic: FactorRunIcSeries | null; layers: FactorRunLayers | null } | null>(null)
  const [reportView, setReportView] = useState<{ runId: string; htmlUrl: string | null; text: string } | null>(null)
  const [pendingInterpret, setPendingInterpret] = useState<string | null>(null)
  const [iterateOn, setIterateOn] = useState<number | null>(null)
  const [iterDirection, setIterDirection] = useState<string>(FACTOR_ITERATE_DIRECTIONS[0])
  const [iterNote, setIterNote] = useState('')
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
    setDetailView(null)
    closeReportView()
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

  /** 关闭报告视图并释放 blob URL（函数式 setState 避免闭包过期）。 */
  const closeReportView = useCallback(() => {
    setReportView(current => {
      if (current?.htmlUrl) URL.revokeObjectURL(current.htmlUrl)
      return null
    })
  }, [])

  /** 展开单 run 检验详情（IC 曲线 + 分层曲线；附件缺失各自降级）。 */
  const toggleDetail = useCallback(async (runId: string) => {
    if (!selectedId) return
    if (detailView?.runId === runId) {
      setDetailView(null)
      return
    }
    setDetailView({ runId, ic: null, layers: null })
    const [ic, layers] = await Promise.all([
      getFactorRunIcSeries(selectedId, runId).catch(() => null),
      getFactorRunLayers(selectedId, runId).catch(() => null),
    ])
    setDetailView({ runId, ic, layers })
  }, [selectedId, detailView])

  /** 看板优先（config.report_id 建链 → 报告库 HTML iframe），失败回退提示。 */
  const showReport = useCallback(async (runId: string) => {
    if (!selectedId) return
    if (reportView?.runId === runId) {
      closeReportView()
      return
    }
    const run = runs.find(item => item.run_id === runId)
    const reportId = runReportId(run)
    closeReportView()
    if (reportId !== null) {
      try {
        const html = await fetchReportHtml(reportId)
        setReportView({ runId, htmlUrl: reportBlobUrl(html), text: '' })
        return
      } catch {
        // 看板不可用（被删/引擎不可达）→ 落回提示
      }
    }
    setError(reportId !== null ? '看板加载失败（报告可能已删除）' : '该 run 未链接报告看板（config 缺 report_id）')
  }, [selectedId, reportView, runs, closeReportView])

  /** 单 run「解读」（§27-F2）：先弹目标选择菜单（factor 类型记忆）。 */
  const askInterpret = useCallback((run: FactorRunSummary) => {
    if (selected === null) return
    if (getAgentBridge() === null) {
      setError('会话联动不可用（sessions/layout 服务缺席）')
      return
    }
    const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
    setPendingInterpret(interpretFactorPrompt({
      factorName: selected.name,
      hypothesis: selected.hypothesis,
      version: run.version,
      universe: run.universe,
      range: runRange(run),
      icMean: num(run.metrics?.ic_mean),
      ir: num(run.metrics?.ir),
      icPositivePct: num(run.metrics?.ic_positive_pct),
      longShortSpread: num(run.metrics?.long_short_spread_pct),
      nPeriods: num(run.metrics?.n_periods),
    }))
  }, [selected])

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
    `附 universe/config（含 n_groups/data_start/data_end/report_id 看板链）/metrics` +
    `（ic_mean/ir/ic_positive_pct/long_short_spread_pct/n_periods）/ic_series/layers。`

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
      {!loading && (
        <FactorsOverview factors={factors} selectedId={selectedId} onSelect={setSelectedId} />
      )}
      {error && <ErrorLine message={error} />}
      {loading ? <Loading text="加载因子库…" /> : (
        <div className="ksq-split">
          <aside className="ksq-list">
            {factors.length === 0
              ? <p className="ksq-hint">暂无因子。用右侧提示词把最近一次因子检验结果入库。</p>
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
              factors.length === 0 ? (
                <div className="ksq-empty">
                  <strong>因子库还是空的</strong>
                  <p>因子检验任务的产物目前只落在工作区文件（data/ 与 reports/）里。归档进因子库后，这里会出现可回看 IC 曲线、跨版本对比、重跑的因子资产。</p>
                  <button className="ksq-linkbtn" type="button" onClick={() => copy(INGEST_PROMPT)}>
                    <IconCopy size={11} /> 复制「把最近一次因子检验结果入库」提示词
                  </button>
                  <p className="ksq-item-meta">粘贴到对话发送即可；后续因子任务会按 factor-analysis-theme 阶段五自动归档。</p>
                </div>
              ) : (
                <p className="ksq-hint">从左侧选择一个因子查看版本时间线与检验对比。</p>
              )
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
                          {' '}
                          <button
                            className="ksq-linkbtn"
                            type="button"
                            onClick={() => { setIterateOn(iterateOn === version.version ? null : version.version); setIterDirection(FACTOR_ITERATE_DIRECTIONS[0]); setIterNote('') }}
                          >
                            {iterateOn === version.version ? '收起迭代' : '从此版本迭代…'}
                          </button>
                          {iterateOn === version.version && (
                            <div className="ksq-iter">
                              <div className="ksq-chips">
                                {FACTOR_ITERATE_DIRECTIONS.map(direction => (
                                  <button
                                    key={direction}
                                    type="button"
                                    className={`ksq-chip ksq-iter-chip ${iterDirection === direction ? 'active' : ''}`}
                                    onClick={() => setIterDirection(direction)}
                                  >
                                    {direction.split('（')[0]}
                                  </button>
                                ))}
                              </div>
                              <input
                                className="ksq-iter-input"
                                value={iterNote}
                                onChange={event => setIterNote(event.target.value)}
                                placeholder="补充要求（可选）：如只测 2024 后区间、行业中性用申万一级…"
                                spellCheck={false}
                              />
                              <div className="ksq-item-meta">方向：{iterDirection}</div>
                              <button
                                className="ksq-linkbtn"
                                type="button"
                                disabled={getAgentBridge() === null}
                                onClick={() => {
                                  if (selected === null || getAgentBridge() === null) return
                                  const latest = runs[0]
                                  const metrics = ['ic_mean', 'ir', 'ic_positive_pct', 'long_short_spread_pct', 'n_periods']
                                    .map(key => {
                                      const value = latest?.metrics?.[key]
                                      return value === undefined ? null : `${key}=${value}`
                                    })
                                    .filter((item): item is string => item !== null)
                                    .join(' / ')
                                  setPendingInterpret(buildFactorIteratePrompt({
                                    factorName: selected.name,
                                    factorId: selected.factor_id,
                                    version: version.version,
                                    params: version.params,
                                    direction: iterDirection,
                                    customNote: iterNote,
                                    baseline: metrics !== '' ? `${metrics}${latest !== undefined && latest.universe !== '' ? `（${latest.universe}）` : ''}` : '',
                                  }))
                                  setIterateOn(null)
                                }}
                              >
                                生成迭代任务（选工作区发送）
                              </button>
                            </div>
                          )}
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
                          <th>详情 / 看板</th>
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
                            <td>{runRange(run)}</td>
                            <td className={`num ${factorMetricClass('ic_mean', run.metrics?.ic_mean)}`}>{metric(run, 'ic_mean')}</td>
                            <td className={`num ${factorMetricClass('ir', run.metrics?.ir)}`}>{metric(run, 'ir')}</td>
                            <td className={`num ${factorMetricClass('ic_positive_pct', run.metrics?.ic_positive_pct)}`}>{metric(run, 'ic_positive_pct')}</td>
                            <td className={`num ${factorMetricClass('long_short_spread_pct', run.metrics?.long_short_spread_pct)}`}>{metric(run, 'long_short_spread_pct')}</td>
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
                  const cumulative = cumulativeIc(detailView.ic?.ic_series)
                  const layerSeries = layersToSeries(detailView.layers?.layers)
                  return (
                    <div className="ksq-compare">
                      <h3>
                        检验详情（{run.run_id.slice(5, 13)} · v{run.version} · {run.universe || '?'} · {runRange(run)}）
                        <button className="ksq-linkbtn" type="button" onClick={() => setDetailView(null)}>收起</button>
                      </h3>
                      <table className="ksq-table">
                        <tbody>
                          <tr>
                            {METRIC_KEYS.map(([key, label]) => (
                              <td key={key}>{label}：<strong className={`num ${factorMetricClass(key, run.metrics?.[key])}`}>{metric(run, key)}</strong></td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                      {cumulative.length >= 2 ? (
                        <div className="ksq-chart">
                          <h4>累计 IC 曲线</h4>
                          <LineOverlay
                            series={[{ label: `v${run.version} 累计IC`, values: cumulative, color: RUN_COLORS[0]! }]}
                            baseline={0}
                            title="累计 IC 曲线"
                          />
                        </div>
                      ) : (
                        <p className="ksq-note">该 run 未存 IC 序列附件（record_run 未附 ic_series）。</p>
                      )}
                      {layerSeries.length >= 2 ? (
                        <div className="ksq-chart">
                          <h4>分层净值曲线（低估值组 G1 ↔ 高估值组 Gn，多空红线上压轴）</h4>
                          <LineOverlay series={layerSeries} baseline={1} title="分层净值曲线" />
                        </div>
                      ) : (
                        <p className="ksq-note">该 run 未存分层附件或形状不可识别（record_run 未附 layers）。</p>
                      )}
                    </div>
                  )
                })()}

                {reportView?.htmlUrl !== null && reportView !== null && (
                  <PreviewDialog title="因子研究看板" onClose={closeReportView}>
                    <iframe title="因子研究看板" src={reportView.htmlUrl ?? undefined} sandbox="allow-scripts" />
                  </PreviewDialog>
                )}

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

      {pendingInterpret !== null && getAgentBridge() !== null && (
        <TaskTargetMenu
          taskKind="factor"
          title="因子解读发送到…"
          prompt={pendingInterpret}
          bridge={getAgentBridge()!}
          useWorkspaces={useWorkspaces}
          onClose={() => setPendingInterpret(null)}
        />
      )}
    </div>
  )
}
