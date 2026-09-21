/**
 * 缠论研究页（三栏证据台）：主图 + 中栏「动力学×形态学」证据链 + 右栏
 * 状态（缠论雷达/联立矩阵/关键位）。数据走宿主 POST /kstock-api/chan-analyze；
 * 深度解读走 TaskTargetMenu（chan 类型独立记忆落点）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { TaskTargetMenu, type TaskRouterBridge, type UseWorkspaces } from '@kstock/quant-ui'
import {
  asArr, asNum, asRec, asStr, evidenceChain, matrixLevels, parseChart,
  radarDims, radarSummary, trendTypeCn, LEVEL_OPTIONS,
  type ChartHighlight, type ChartSlice, type MatrixBrief, type Rec,
} from './derive.ts'
import { ChanChart } from './chart.tsx'
import { BackchiCard, BSPointsCard, ChainStrip, ZhongshuCard, type CardFocusEvent } from './evidence.tsx'
import { ChanRadar, KeyLevelsCard, LevelMatrix, SignalDetailsCollapsible, type MatrixRowUI } from './status.tsx'

/** 桥（index.tsx 注入；页面为 slot 组件拿不到 ctx，模块级单例传递）。 */
let chanBridge: TaskRouterBridge | null = null

/** 深度解读提示词（与改版前一致，喂结构摘要 + 信号明细）。 */
function interpretChanPrompt(payload: Rec, stock: string, level: string): string {
  const morph = asRec(payload.morphology)
  const trend = asRec(payload.trend_analysis)
  const advice = asRec(payload.trading_advice)
  const scores = asRec(payload.signal_scores)
  const signals = asArr(scores.signal_details).slice(0, 10).map(item => {
    const r = asRec(item)
    return `${asStr(r.name)}=${asStr(r.value)}`
  })
  const zhongshus = asArr(asRec(payload.chart_data).zhongshu_zones).map(item => {
    const r = asRec(item)
    return `${asNum(r.low)?.toFixed(2) ?? '?'}~${asNum(r.high)?.toFixed(2) ?? '?'}`
  })
  return `缠论研究面板对 ${asStr(payload.stock_name) || stock}（${asStr(payload.stock_code)}，${level} 级）的结构分析：`
    + `K线 ${asNum(morph.klines_count) ?? '?'} 根 → 分型 ${asNum(morph.fenxings_count) ?? '?'} / 笔 ${asNum(morph.bis_count) ?? '?'} / 段 ${asNum(morph.segs_count) ?? '?'} / 中枢 ${asNum(morph.zhongshus_count) ?? '?'}${zhongshus.length > 0 ? `（区间 ${zhongshus.join('、')}）` : ''}；`
    + `走势 ${trendTypeCn(trend) || asStr(trend.type)}（强度 ${asNum(trend.trend_strength) ?? '?'}），现价 ${asNum(trend.latest_price) ?? '?'}；`
    + `买卖点 买 ${asNum(asRec(payload.dynamics).buy_points_count) ?? 0} / 卖 ${asNum(asRec(payload.dynamics).sell_points_count) ?? 0}，背驰 ${asNum(asRec(payload.dynamics).backchi_count) ?? 0} 处；`
    + `操作参考 ${asStr(advice.recommended_action)}；信号评分 ${asNum(scores.final_score) ?? '?'}（${asStr(scores.direction)} / ${asStr(scores.strength)}），信号明细：${signals.length > 0 ? signals.join('；') : '无'}。`
    + `请做缠论深度解读：当前级别在走势中的位置（趋势/盘整）、中枢演化方向、买卖点的级别联立确认（可再跑多级别）、`
    + `背驰与动能结构、操作计划（入场/止损/目标位与级别匹配）与失效条件。`
    + `可用 stock-analysis 技能的缠论引擎补充多级别分析；数据缺失诚实标注「无数据」，不构成投资建议。`
}

/** 窄屏检测（<1100px 中栏并入右栏 Tab 化）。 */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1100px)')
    const onChange = (event: MediaQueryListEvent): void => { setNarrow(event.matches) }
    mq.addEventListener('change', onChange)
    return () => { mq.removeEventListener('change', onChange) }
  }, [])
  return narrow
}

/** 缠论研究页：三栏证据台（宽屏）/ 图上 + Tab 面板（窄屏）。 */
export function ChanPage({ useWorkspaces }: { useWorkspaces?: UseWorkspaces } = {}) {
  const [stock, setStock] = useState('')
  const [level, setLevel] = useState<string>('daily')
  const [payload, setPayload] = useState<Rec | null>(null)
  const [chart, setChart] = useState<ChartSlice | null>(null)
  const [view, setView] = useState({ start: 0, count: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingAsk, setPendingAsk] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<Record<string, Rec | 'loading' | 'error' | 'empty'>>({})
  const [highlight, setHighlight] = useState<ChartHighlight | null>(null)
  const [sideTab, setSideTab] = useState<'evidence' | 'status'>('evidence')
  const narrow = useNarrow()
  const hlTimer = useRef<number | null>(null)
  // 竞态守卫：仅最新一次 analyze / 矩阵扇出可落状态（快速切股票/级别时旧响应丢弃）
  const analyzeSeq = useRef(0)
  const matrixSeq = useRef(0)

  const analyze = useCallback(async (targetStock: string, targetLevel: string) => {
    if (targetStock.trim() === '') return
    const my = ++analyzeSeq.current
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/kstock-api/chan-analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stock: targetStock.trim(), level: targetLevel }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => null)
        throw new Error((detail as { detail?: string } | null)?.detail ?? `分析失败（${response.status}）`)
      }
      const data = (await response.json()) as Rec
      if (my !== analyzeSeq.current) return
      setPayload(data)
      const next = parseChart(data)
      setChart(next)
      setView({ start: 0, count: Math.max(1, next?.dates.length ?? 1) })
      setHighlight(null)
    } catch (err) {
      if (my !== analyzeSeq.current) return
      setError(err instanceof Error ? err.message : '分析失败')
      setPayload(null)
      setChart(null)
    } finally {
      if (my === analyzeSeq.current) setLoading(false)
    }
  }, [])

  useEffect(() => { void analyze('000001', 'daily') }, [analyze])

  // 联立矩阵：当前级别的其余 3 档并行拉取（含低一档；分钟级可能配额不足 → empty 行；硬失败 → error 行）。
  const stockCode = payload !== null ? asStr(payload.stock_code) : ''
  useEffect(() => {
    if (stockCode === '') { matrixSeq.current += 1; setMatrix({}); return }
    const my = ++matrixSeq.current
    const others = matrixLevels(level).filter(l => l !== level)
    setMatrix(Object.fromEntries(others.map(l => [l, 'loading' as const])))
    for (const other of others) {
      void fetch('/kstock-api/chan-analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stock: stockCode, level: other }),
      })
        .then(async response => {
          if (my !== matrixSeq.current) return
          if (!response.ok) throw new Error('failed')
          const data = (await response.json()) as Rec
          if (my !== matrixSeq.current) return
          const parsed = parseChart(data)
          // 分钟级配额不足：引擎可能返回 200 但 K 线极少——按数据不足处理。
          if (parsed === null || parsed.dates.length < 30) throw new Error('insufficient')
          setMatrix(current => ({ ...current, [other]: data }))
        })
        .catch((err: unknown) => {
          if (my !== matrixSeq.current) return
          const kind = err instanceof Error && err.message === 'insufficient' ? 'empty' as const : 'error' as const
          setMatrix(current => ({ ...current, [other]: kind }))
        })
    }
  }, [stockCode, level])

  useEffect(() => () => { if (hlTimer.current !== null) window.clearTimeout(hlTimer.current) }, [])

  /** 卡片联动：视图聚焦到区间 + 脉冲高亮 2.4s 后自清。 */
  const onCardFocus = useCallback((focus: CardFocusEvent) => {
    const total = chart?.dates.length ?? 0
    if (total === 0) return
    const span = Math.max(40, focus.endIdx - focus.startIdx + 24)
    const start = Math.max(0, Math.min(total - span, focus.startIdx - 12))
    setView({ start, count: Math.min(span, total) })
    if (focus.hl.id >= 0) {
      setHighlight({ kind: focus.hl.kind, id: focus.hl.id })
      if (hlTimer.current !== null) { window.clearTimeout(hlTimer.current) }
      hlTimer.current = window.setTimeout(() => { setHighlight(null) }, 2400)
    }
  }, [chart])

  const morph = payload !== null ? asRec(payload.morphology) : {}
  const dynamics = payload !== null ? asRec(payload.dynamics) : {}
  const advice = payload !== null ? asRec(payload.trading_advice) : {}
  const scores = payload !== null ? asRec(payload.signal_scores) : {}
  const assessment = payload !== null ? asRec(payload.assessment) : {}
  const lastZhongshu = chart !== null && chart.zhongshus.length > 0 ? chart.zhongshus[chart.zhongshus.length - 1] ?? null : null

  const matrixRows: MatrixRowUI[] = matrixLevels(level).map(l => {
    if (l === level) return { level: l, status: payload !== null ? 'ok' : 'loading', data: payload ?? undefined, current: true }
    const cell = matrix[l]
    if (cell === undefined) return { level: l, status: 'empty' }
    if (cell === 'loading') return { level: l, status: 'loading' }
    if (cell === 'empty') return { level: l, status: 'empty' }
    if (cell === 'error') return { level: l, status: 'error' }
    return { level: l, status: 'ok', data: cell }
  })
  const matrixBriefs: MatrixBrief[] = matrixRows.map(r =>
    r.status === 'ok' && r.data !== undefined ? { status: 'ok', data: r.data } : { status: r.status === 'loading' ? 'loading' : 'error' },
  )
  const dims = payload !== null ? radarDims(payload, matrixBriefs) : []
  const summary = radarSummary(dims)
  const chain = payload !== null ? evidenceChain(payload, chart) : []

  const evidenceColumn = (
    <div className="ksq-chanx-evi">
      <ChainStrip segments={chain} />
      {chart !== null && <BackchiCard chart={chart} onFocus={onCardFocus} />}
      {payload !== null && <BSPointsCard payload={payload} chart={chart} onFocus={onCardFocus} />}
      <ZhongshuCard chart={chart} payload={payload ?? {}} onFocus={onCardFocus} />
    </div>
  )
  const statusColumn = (
    <div className="ksq-chanx-side2">
      <div className="ksq-chanx-card"><ChanRadar dims={dims} summary={summary} /></div>
      <LevelMatrix rows={matrixRows} />
      <KeyLevelsCard advice={advice} lastZhongshu={lastZhongshu} assessment={assessment} />
    </div>
  )
  /** 信号明细挂在图表下方（宽列横排 chips + 高度封顶滚动），不再拖长右栏。 */
  const signalDetails = <SignalDetailsCollapsible scores={scores} />

  return (
    <div className="ksq-page">
      <header className="ksq-topbar">
        <div className="ksq-title">
          <strong>缠论研究</strong>
          <span>动力学 × 形态学 · 证据链 · 级别联立</span>
        </div>
      </header>
      <div className="ksq-body">
        <div className="ksq-toolbar">
          <input
            className="ksq-chan-input"
            value={stock}
            onChange={event => setStock(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') void analyze(stock, level) }}
            placeholder="代码或名称（600519 / 茅台 / 000001.SH）"
            spellCheck={false}
          />
          <select
            className="ksq-chan-select"
            title="分钟级（60/90/120min）依赖 tushare 分钟线配额，数据量可能不足而降级"
            value={level}
            onChange={event => { setLevel(event.target.value); if (payload !== null) void analyze(stock || asStr(payload.stock_code), event.target.value) }}
          >
            {LEVEL_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
          <button className="ksq-linkbtn" type="button" disabled={loading || stock.trim() === ''} onClick={() => void analyze(stock, level)}>
            {loading ? '分析中…' : '分析'}
          </button>
          {payload !== null && (
            <>
              <span className="ksq-count">
                笔 {asNum(morph.bis_count) ?? '—'} · 段 {asNum(morph.segs_count) ?? '—'} · 中枢 {asNum(morph.zhongshus_count) ?? '—'}
                {' '}· 买 {asNum(dynamics.buy_points_count) ?? 0} / 卖 {asNum(dynamics.sell_points_count) ?? 0} · 背驰 {asNum(dynamics.backchi_count) ?? 0}
              </span>
              <button
                className="ksq-linkbtn"
                type="button"
                disabled={chanBridge === null}
                onClick={() => { if (chanBridge !== null && payload !== null) setPendingAsk(interpretChanPrompt(payload, stock, level)) }}
              >
                让 Agent 深度解读
              </button>
            </>
          )}
        </div>
        {error !== null && <p className="ksq-note">{error}</p>}
        {!loading && error === null && payload === null && (
          <p className="ksq-note">本级别数据不足（引擎返回为空或有效 K 线过少），请切换级别或稍后再试。</p>
        )}

        {payload !== null && chart !== null && !narrow && (
          <div className="ksq-chanx-grid">
            <div className="ksq-chanx-chartcol-wrap">
              <ChanChart chart={chart} payload={payload} view={view} onViewChange={setView} highlight={highlight} />
              {signalDetails}
            </div>
            {evidenceColumn}
            {statusColumn}
          </div>
        )}

        {payload !== null && chart !== null && narrow && (
          <div className="ksq-chanx-grid narrow">
            <div className="ksq-chanx-chartcol-wrap">
              <ChanChart chart={chart} payload={payload} view={view} onViewChange={setView} highlight={highlight} />
              {signalDetails}
            </div>
            <div className="ksq-chanx-tabpanel">
              <div className="ksq-chanx-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={sideTab === 'evidence'} className={`ksq-chanx-tab${sideTab === 'evidence' ? ' on' : ''}`} onClick={() => setSideTab('evidence')}>证据链</button>
                <button type="button" role="tab" aria-selected={sideTab === 'status'} className={`ksq-chanx-tab${sideTab === 'status' ? ' on' : ''}`} onClick={() => setSideTab('status')}>状态 / 联立</button>
              </div>
              {sideTab === 'evidence' ? evidenceColumn : statusColumn}
            </div>
          </div>
        )}

        {pendingAsk !== null && chanBridge !== null && (
          <TaskTargetMenu
            taskKind="chan"
            title="缠论深度解读发送到…"
            prompt={pendingAsk}
            bridge={chanBridge}
            useWorkspaces={useWorkspaces}
            onClose={() => setPendingAsk(null)}
          />
        )}
      </div>
    </div>
  )
}

/** index.tsx 注入共享路由桥（模块级单例传递给 slot 组件）。 */
ChanPage.bindBridge = (bridge: TaskRouterBridge): void => { chanBridge = bridge }
