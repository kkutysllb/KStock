/**
 * 缠论研究面板：交互式 K 线缠论图 + 形态/走势/信号摘要 + Agent 深度解读。
 *
 * 数据走宿主 `POST /kstock-api/chan-analyze`（{stock, level} → 引擎 JSON，
 * 60s 服务端缓存）。图表自研 SVG：蜡烛（A 股红涨绿跌）+ 笔/段折线 +
 * 中枢矩形 + 买卖点徽章 + 成交量副图，hover 十字线逐根读值。
 * 深度解读走 TaskTargetMenu（chan 类型独立记忆落点）。
 */

import { useCallback, useEffect, useState } from 'react'
import { TaskTargetMenu, type TaskRouterBridge, type UseWorkspaces } from '@kstock/quant-ui'
import {
  asArr, asNum, asRec, asStr, dateIndexOf, parseChart, resolveIndex,
  LEVEL_OPTIONS, type ChartSlice, type Rec,
} from './derive.ts'
import { ChanChart } from './chart.tsx'

/** 桥（index.tsx 注入；页面为 slot 组件拿不到 ctx，模块级单例传递）。 */
let chanBridge: TaskRouterBridge | null = null

/** 七类信号雷达（SVG 七边形，czsc 式分类）。 */
function SignalRadar({ radar, score, direction, strength }: { radar: Rec; score: number | null; direction: string; strength: string }): React.ReactElement {
  const categories = ['cxt', 'tas', 'vol', 'bar', 'pos', 'jcc', 'sta']
  const labels: Record<string, string> = { cxt: '形态', tas: '走势', vol: '量能', bar: 'K线', pos: '位置', jcc: '交叉', sta: '统计' }
  const cx = 78, cy = 72, r = 52
  const angle = (i: number) => (Math.PI * 2 * i) / categories.length - Math.PI / 2
  const point = (i: number, value: number): [number, number] => [cx + Math.cos(angle(i)) * r * value, cy + Math.sin(angle(i)) * r * value]
  const values = categories.map(c => {
    const v = asNum(radar[c])
    return v === null ? 0.5 : Math.max(0, Math.min(1, v / 100))
  })
  const polygon = values.map((v, i) => point(i, v).join(',')).join(' ')
  return (
    <div className="ksq-chan-radar">
      <svg viewBox="0 0 156 144" role="img" aria-label="信号雷达">
        {[0.25, 0.5, 0.75, 1].map(ring => (
          <polygon key={ring} points={categories.map((_, i) => point(i, ring).join(',')).join(' ')} fill="none" stroke="var(--dsw-alias-border-l3)" strokeWidth="0.6" />
        ))}
        {categories.map((cat, i) => {
          const [px, py] = point(i, 1)
          return <line key={cat} x1={cx} y1={cy} x2={px} y2={py} stroke="var(--dsw-alias-border-l3)" strokeWidth="0.6" />
        })}
        <polygon points={polygon} fill="rgba(232,163,61,0.3)" stroke="#e8a33d" strokeWidth="1.4" />
        {categories.map((cat, i) => {
          const [px, py] = point(i, 1.22)
          return <text key={`l-${cat}`} x={px} y={py + 3} fontSize="9" textAnchor="middle" fill="var(--dsw-alias-label-tertiary)">{labels[cat] ?? cat}</text>
        })}
      </svg>
      <div className="ksq-chan-radar-meta">
        <strong className={direction === 'bullish' ? 'ksq-up' : direction === 'bearish' ? 'ksq-down' : ''}>
          {score !== null ? score.toFixed(1) : '—'} 分 · {direction === 'bullish' ? '偏多' : direction === 'bearish' ? '偏空' : direction}
        </strong>
        <span className="ksq-item-meta">强度：{strength === 'weak' ? '弱' : strength === 'strong' ? '强' : strength}</span>
      </div>
    </div>
  )
}

/** 深度解读提示词（结构摘要 + 信号明细 → czsc 式信号字典作解读输入）。 */
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
    + `走势 ${asStr(trend.type_cn) || asStr(trend.type)}（强度 ${asNum(trend.trend_strength) ?? '?'}），现价 ${asNum(trend.latest_price) ?? '?'}；`
    + `买卖点 买 ${asNum(asRec(payload.dynamics).buy_points_count) ?? 0} / 卖 ${asNum(asRec(payload.dynamics).sell_points_count) ?? 0}，背驰 ${asNum(asRec(payload.dynamics).backchi_count) ?? 0} 处；`
    + `操作参考 ${asStr(advice.recommended_action)}；信号评分 ${asNum(scores.final_score) ?? '?'}（${asStr(scores.direction)} / ${asStr(scores.strength)}），信号明细：${signals.length > 0 ? signals.join('；') : '无'}。`
    + `请做缠论深度解读：当前级别在走势中的位置（趋势/盘整）、中枢演化方向、买卖点的级别联立确认（可再跑多级别）、`
    + `背驰与动能结构、操作计划（入场/止损/目标位与级别匹配）与失效条件。`
    + `可用 stock-analysis 技能的缠论引擎补充多级别分析；数据缺失诚实标注「无数据」，不构成投资建议。`
}

/** 缠论研究页：左 K 线（缩放/拖拽）+ 右信息栏（摘要/多级别/信号流/关键位）。 */
export function ChanPage({ useWorkspaces }: { useWorkspaces?: UseWorkspaces } = {}) {
  const [stock, setStock] = useState('')
  const [level, setLevel] = useState<string>('daily')
  const [payload, setPayload] = useState<Rec | null>(null)
  const [chart, setChart] = useState<ChartSlice | null>(null)
  const [view, setView] = useState({ start: 0, count: 1 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingAsk, setPendingAsk] = useState<string | null>(null)
  const [levelsBrief, setLevelsBrief] = useState<Record<string, Rec | 'loading' | 'error'>>({})

  const analyze = useCallback(async (targetStock: string, targetLevel: string) => {
    if (targetStock.trim() === '') return
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
      setPayload(data)
      const next = parseChart(data)
      setChart(next)
      setView({ start: 0, count: Math.max(1, next?.dates.length ?? 1) })
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
      setPayload(null)
      setChart(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void analyze('000001', 'daily') }, [analyze])

  // 多级别状态条（懒加载）：当前级别的更高两档并行取摘要。
  const stockCode = payload !== null ? asStr(payload.stock_code) : ''
  useEffect(() => {
    if (stockCode === '') { setLevelsBrief({}); return }
    const idx = LEVEL_OPTIONS.indexOf(level as (typeof LEVEL_OPTIONS)[number])
    const others = LEVEL_OPTIONS.slice(idx + 1, idx + 3).length >= 2
      ? LEVEL_OPTIONS.slice(idx + 1, idx + 3)
      : LEVEL_OPTIONS.slice(0, 2)
    setLevelsBrief(Object.fromEntries(others.map(l => [l, 'loading' as const])))
    for (const other of others) {
      void fetch('/kstock-api/chan-analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stock: stockCode, level: other }),
      })
        .then(async response => {
          if (!response.ok) throw new Error('fail')
          const data = (await response.json()) as Rec
          setLevelsBrief(current => ({ ...current, [other]: data }))
        })
        .catch(() => { setLevelsBrief(current => ({ ...current, [other]: 'error' as const })) })
    }
  }, [stockCode, level])

  /** 信号定位：把 K 线窗口聚焦到该索引 ±40 根。 */
  const focusIndex = useCallback((index: number, total: number) => {
    setView({ start: Math.max(0, Math.min(Math.max(0, total - 80), index - 40)), count: Math.min(80, Math.max(15, total)) })
  }, [])

  const morph = payload !== null ? asRec(payload.morphology) : {}
  const trend = payload !== null ? asRec(payload.trend_analysis) : {}
  const dynamics = payload !== null ? asRec(payload.dynamics) : {}
  const advice = payload !== null ? asRec(payload.trading_advice) : {}
  const scores = payload !== null ? asRec(payload.signal_scores) : {}
  const total = chart?.dates.length ?? 0

  // 信号流数据：买卖点 markers + 最近 6 笔端点（可点击定位）。
  const signalRows: Array<{ key: string; date: string; label: string; price: number | null; index: number }> = []
  if (chart !== null) {
    const dateIndex = dateIndexOf(chart.dates)
    for (const marker of chart.markers) {
      const time = asStr(marker.time)
      const index = resolveIndex(dateIndex, time)
      if (index >= 0) {
        signalRows.push({ key: `m-${index}-${asStr(marker.label)}`, date: time.slice(0, 10), label: asStr(marker.label ?? marker.type ?? '信号'), price: asNum(marker.price), index })
      }
    }
    for (const bi of chart.biLines.slice(-6).reverse()) {
      const endIndex = resolveIndex(dateIndex, bi.end_time)
      if (endIndex >= 0) {
        signalRows.push({ key: `b-${endIndex}`, date: bi.end_time.slice(0, 10), label: `笔转折（${bi.end_price >= bi.start_price ? '向上' : '向下'}）`, price: bi.end_price, index: endIndex })
      }
    }
  }
  const lastZhongshu = chart !== null && chart.zhongshus.length > 0 ? chart.zhongshus[chart.zhongshus.length - 1] ?? null : null

  return (
    <div className="ksq-page">
      <header className="ksq-topbar">
        <div className="ksq-title">
          <strong>缠论研究</strong>
          <span>笔段中枢 · 买卖点 · 背驰 · 信号雷达</span>
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
              <span className="ksq-count">{asStr(payload.stock_name)} {asStr(payload.stock_code)} · {asStr(payload.time_level)}</span>
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

        {payload !== null && (
          <div className="ksq-chan-main">
            <div className="ksq-chan-chartwrap">
              {chart !== null && <ChanChart chart={chart} payload={payload} view={view} onViewChange={setView} highlight={null} />}
            </div>
            <aside className="ksq-chan-side">
              <div className="ksq-chan-sidecard">
                <strong>结构</strong>
                <span>笔 {asNum(morph.bis_count) ?? '—'} · 段 {asNum(morph.segs_count) ?? '—'} · 中枢 {asNum(morph.zhongshus_count) ?? '—'}</span>
                <span>{asStr(trend.type_cn) || '—'} · 强度 {asNum(trend.trend_strength) ?? '—'} · 现价 {asNum(trend.latest_price) ?? '—'}</span>
                <span>买 {asNum(dynamics.buy_points_count) ?? 0} / 卖 {asNum(dynamics.sell_points_count) ?? 0} · 背驰 {asNum(dynamics.backchi_count) ?? 0}</span>
                <span className="ksq-item-meta">操作参考 {asStr(advice.recommended_action) || '—'}</span>
              </div>
              <div className="ksq-chan-sidecard">
                <strong>多级别联立</strong>
                {Object.entries(levelsBrief).map(([lvl, brief]) => (
                  <span key={lvl} className="ksq-chan-levelrow">
                    <em>{lvl}</em>
                    {brief === 'loading' ? '加载中…' : brief === 'error' ? '加载失败' : (
                      <>
                        {' '}{asStr(asRec(brief.trend_analysis).type_cn) || '—'}
                        {' '}买{asNum(asRec(brief.dynamics).buy_points_count) ?? 0}/卖{asNum(asRec(brief.dynamics).sell_points_count) ?? 0}
                        {' '}{asNum(asRec(brief.signal_scores).final_score)?.toFixed(0) ?? '—'}分
                      </>
                    )}
                  </span>
                ))}
                {Object.keys(levelsBrief).length === 0 && <span className="ksq-item-meta">—</span>}
              </div>
              <div className="ksq-chan-sidecard">
                <strong>信号流（点击定位图）</strong>
                {signalRows.length === 0 && <span className="ksq-item-meta">无买卖点/笔转折信号</span>}
                {signalRows.slice(0, 10).map(row => (
                  <button
                    key={row.key}
                    type="button"
                    className={`ksq-chan-signal ${row.label.includes('买') || row.label.startsWith('B') ? 'up' : row.label.includes('卖') || row.label.startsWith('S') ? 'down' : ''}`}
                    onClick={() => { if (total > 0) focusIndex(row.index, total) }}
                    title={`定位到 ${row.date}`}
                  >
                    <em>{row.date}</em>
                    <span>{row.label}</span>
                    <b>{row.price !== null ? row.price.toFixed(2) : ''}</b>
                  </button>
                ))}
              </div>
              <div className="ksq-chan-sidecard">
                <strong>关键位</strong>
                {lastZhongshu !== null ? (
                  <>
                    <span>中枢 {lastZhongshu.low.toFixed(2)} ~ {lastZhongshu.high.toFixed(2)}（中轴 {lastZhongshu.center.toFixed(2)}）</span>
                    <span className="ksq-item-meta">上沿压力 {lastZhongshu.high.toFixed(2)} · 下沿支撑 {lastZhongshu.low.toFixed(2)}</span>
                  </>
                ) : <span className="ksq-item-meta">无中枢数据</span>}
                <span>入场 {asNum(advice.entry_price)?.toFixed(2) ?? '—'} · 止损 {asNum(advice.stop_loss)?.toFixed(2) ?? '—'} · 目标 {asNum(advice.take_profit)?.toFixed(2) ?? '—'}</span>
              </div>
            </aside>
          </div>
        )}

        {payload !== null && (
          <div className="ksq-chan-summary">
            <SignalRadar
              radar={asRec(scores.radar_data)}
              score={asNum(scores.final_score)}
              direction={asStr(scores.direction)}
              strength={asStr(scores.strength)}
            />
            <div className="ksq-chan-signals">
              <strong>信号明细</strong>
              <div className="ksq-chips">
                {asArr(scores.signal_details).slice(0, 12).map((item, index) => {
                  const r = asRec(item)
                  return <span key={index} className="ksq-chip ksq-mono">{asStr(r.name)} {asStr(r.value)}</span>
                })}
                {asArr(scores.signal_details).length === 0 && <span className="ksq-item-meta">无信号</span>}
              </div>
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
