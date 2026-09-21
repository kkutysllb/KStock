/**
 * 缠论研究面板：交互式 K 线缠论图 + 形态/走势/信号摘要 + Agent 深度解读。
 *
 * 数据走宿主 `POST /kstock-api/chan-analyze`（{stock, level} → 引擎 JSON，
 * 60s 服务端缓存）。图表自研 SVG：蜡烛（A 股红涨绿跌）+ 笔/段折线 +
 * 中枢矩形 + 买卖点徽章 + 成交量副图，hover 十字线逐根读值。
 * 深度解读走 TaskTargetMenu（chan 类型独立记忆落点）。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { TaskTargetMenu, type TaskRouterBridge, type UseWorkspaces } from '@kstock/quant-ui'

/** 引擎 JSON 的宽松取值助手。 */
type Rec = Record<string, unknown>
const asRec = (v: unknown): Rec => (typeof v === 'object' && v !== null ? v as Rec : {})
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const asStr = (v: unknown): string => (typeof v === 'string' ? v : '')

/** 桥（index.tsx 注入；页面为 slot 组件拿不到 ctx，模块级单例传递）。 */
let chanBridge: TaskRouterBridge | null = null

/** 图表数据切片（引擎 chart_data）。 */
interface ChartSlice {
  dates: string[]
  kline: Array<[number, number, number, number]> // [open, close, low, high]
  volumes: number[]
  biLines: Array<{ start_time: string; end_time: string; start_price: number; end_price: number; direction?: string }>
  segLines: Array<{ start_time: string; end_time: string; start_price: number; end_price: number }>
  zhongshus: Array<{ start_time: string; end_time: string; high: number; low: number; center: number }>
  markers: Array<Rec>
}

function parseChart(payload: Rec): ChartSlice | null {
  const c = asRec(payload.chart_data)
  const dates = asArr(c.dates).map(asStr)
  const kline = asArr(c.kline).map(item => {
    const k = asArr(item)
    return [Number(k[0]), Number(k[1]), Number(k[2]), Number(k[3])] as [number, number, number, number]
  })
  if (dates.length < 2 || kline.length !== dates.length) return null
  return {
    dates,
    kline,
    volumes: asArr(c.volumes).map(v => asNum(v) ?? 0),
    biLines: asArr(c.bi_lines).map(item => {
      const r = asRec(item)
      return { start_time: asStr(r.start_time), end_time: asStr(r.end_time), start_price: asNum(r.start_price) ?? 0, end_price: asNum(r.end_price) ?? 0 }
    }),
    segLines: asArr(c.seg_lines).map(item => {
      const r = asRec(item)
      return { start_time: asStr(r.start_time), end_time: asStr(r.end_time), start_price: asNum(r.start_price) ?? 0, end_price: asNum(r.end_price) ?? 0 }
    }),
    zhongshus: asArr(c.zhongshu_zones).map(item => {
      const r = asRec(item)
      return { start_time: asStr(r.start_time), end_time: asStr(r.end_time), high: asNum(r.high) ?? 0, low: asNum(r.low) ?? 0, center: asNum(r.center) ?? 0 }
    }),
    markers: asArr(c.markers).map(asRec),
  }
}

const LEVEL_OPTIONS = ['30min', 'daily', 'weekly', 'monthly'] as const
const W = 720
const H_MAIN = 300
const H_VOL = 56
const PAD_L = 54
const PAD_R = 14
const H_TOTAL = H_MAIN + H_VOL + 26

/** K 线缠论主图（含成交量副图；hover 十字线逐根读值）。 */
function ChanChart({ chart }: { chart: ChartSlice }): React.ReactElement {
  const { dates, kline, volumes } = chart
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  const lows = kline.map(k => k[2]).concat(chart.zhongshus.map(z => z.low))
  const highs = kline.map(k => k[3]).concat(chart.zhongshus.map(z => z.high))
  const pMin = Math.min(...lows)
  const pMax = Math.max(...highs)
  const pSpan = pMax - pMin || 1
  const vMax = Math.max(...volumes, 1)
  const slot = (W - PAD_L - PAD_R) / dates.length
  const x = (index: number) => PAD_L + (index + 0.5) * slot
  const yMain = (price: number) => 12 + (1 - (price - pMin) / pSpan) * (H_MAIN - 26)
  const yVol = (volume: number) => H_MAIN + 4 + (1 - volume / vMax) * (H_VOL - 10)
  // 日期（YYYY-MM-DD 前缀）→ 索引（笔/段/中枢的时间轴定位）。
  const dateIndex = new Map<string, number>()
  dates.forEach((date, index) => dateIndex.set(date.slice(0, 10), index))
  const indexOfTime = (time: string): number => dateIndex.get(time.slice(0, 10)) ?? -1

  const onMove = (event: React.MouseEvent<SVGSVGElement>): void => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect === undefined || rect.width === 0) return
    const vx = ((event.clientX - rect.left) / rect.width) * W
    const index = Math.floor((vx - PAD_L) / slot)
    setHover(index >= 0 && index < dates.length ? index : null)
  }

  const hoverK = hover !== null ? kline[hover] ?? null : null
  const hoverOpen = hoverK?.[0]
  const hoverClose = hoverK?.[1]
  const hoverPct = hoverOpen !== undefined && hoverOpen > 0 && hoverClose !== undefined ? ((hoverClose - hoverOpen) / hoverOpen * 100) : null

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H_TOTAL}`} role="img" aria-label="缠论 K 线结构图" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      {/* 价格网格 */}
      {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
        const price = pMin + pSpan * (1 - ratio)
        return (
          <g key={`grid-${ratio}`}>
            <line x1={PAD_L} y1={yMain(price)} x2={W - PAD_R} y2={yMain(price)} stroke="var(--dsw-alias-border-l3)" strokeDasharray="2,4" />
            <text x={PAD_L - 6} y={yMain(price) + 3} fontSize="10" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">{price.toFixed(2)}</text>
          </g>
        )
      })}
      {/* 中枢矩形（先画，垫底） */}
      {chart.zhongshus.map((zone, i) => {
        const x1 = indexOfTime(zone.start_time)
        const x2 = indexOfTime(zone.end_time)
        if (x1 < 0 || x2 < x1) return null
        return (
          <g key={`zs-${i}`}>
            <rect x={x(x1) - slot / 2} y={yMain(zone.high)} width={(x2 - x1 + 1) * slot} height={Math.max(2, yMain(zone.low) - yMain(zone.high))} fill="rgba(199,146,234,0.14)" stroke="#c792ea" strokeDasharray="4,3" rx="2" />
            <line x1={x(x1) - slot / 2} y1={yMain(zone.center)} x2={x(x2) + slot / 2} y2={yMain(zone.center)} stroke="#c792ea" strokeWidth="1" strokeDasharray="2,3" />
            <text x={x(x1) + 2} y={yMain(zone.high) - 3} fontSize="9.5" fill="#c792ea">中枢 {zone.low.toFixed(2)}~{zone.high.toFixed(2)}</text>
          </g>
        )
      })}
      {/* 蜡烛（A 股红涨绿跌） */}
      {kline.map((k, index) => {
        const up = k[1] >= k[0]
        const color = up ? '#e05656' : '#2f9e77'
        const cx = x(index)
        const bodyTop = yMain(Math.max(k[0], k[1]))
        const bodyBottom = yMain(Math.min(k[0], k[1]))
        return (
          <g key={`k-${index}`}>
            <line x1={cx} y1={yMain(k[3])} x2={cx} y2={yMain(k[2])} stroke={color} strokeWidth={Math.max(0.6, slot * 0.12)} />
            <rect x={cx - Math.max(0.8, slot * 0.32)} y={bodyTop} width={Math.max(1.6, slot * 0.64)} height={Math.max(1, bodyBottom - bodyTop)} fill={color} opacity={hover === index ? 1 : 0.88} />
          </g>
        )
      })}
      {/* 笔（半透明折线） */}
      {chart.biLines.map((bi, i) => {
        const x1 = indexOfTime(bi.start_time); const x2 = indexOfTime(bi.end_time)
        if (x1 < 0 || x2 < 0) return null
        return <line key={`bi-${i}`} x1={x(x1)} y1={yMain(bi.start_price)} x2={x(x2)} y2={yMain(bi.end_price)} stroke="#e8a33d" strokeWidth="1.6" opacity="0.85" />
      })}
      {/* 线段（更粗虚线） */}
      {chart.segLines.map((seg, i) => {
        const x1 = indexOfTime(seg.start_time); const x2 = indexOfTime(seg.end_time)
        if (x1 < 0 || x2 < 0) return null
        return <line key={`seg-${i}`} x1={x(x1)} y1={yMain(seg.start_price)} x2={x(x2)} y2={yMain(seg.end_price)} stroke="#5ab0ff" strokeWidth="2.2" strokeDasharray="7,4" opacity="0.9" />
      })}
      {/* 买卖点徽章 */}
      {chart.markers.map((marker, i) => {
        const time = asStr(marker.time ?? marker.date)
        const index = indexOfTime(time)
        const price = asNum(marker.price)
        if (index < 0 || price === null) return null
        const label = asStr(marker.label ?? marker.type ?? '?')
        const isBuy = label.toLowerCase().includes('b') || label.includes('买')
        return (
          <g key={`mk-${i}`}>
            <circle cx={x(index)} cy={yMain(price)} r="7" fill={isBuy ? '#31c7a2' : '#e64646'} opacity="0.92" />
            <text x={x(index)} y={yMain(price) + 3} fontSize="8.5" textAnchor="middle" fill="#fff" fontWeight="600">{label.slice(0, 2)}</text>
          </g>
        )
      })}
      {/* 成交量副图 */}
      <line x1={PAD_L} y1={H_MAIN + 4} x2={W - PAD_R} y2={H_MAIN + 4} stroke="var(--dsw-alias-border-l3)" />
      {volumes.map((volume, index) => {
        const k = kline[index]
        const up = k !== undefined && k[1] >= k[0]
        return (
          <rect key={`v-${index}`} x={x(index) - Math.max(0.8, slot * 0.32)} y={yVol(volume)} width={Math.max(1.6, slot * 0.64)} height={H_MAIN + 4 + (H_VOL - 10) - yVol(volume)} fill={up ? '#e05656' : '#2f9e77'} opacity="0.55" />
        )
      })}
      <text x={PAD_L - 6} y={H_MAIN + 14} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">量</text>
      {/* 图例 */}
      <g fontSize="9.5">
        <text x={PAD_L} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">红涨绿跌 ·</text>
        <line x1={PAD_L + 46} y1={H_TOTAL - 7} x2={PAD_L + 66} y2={H_TOTAL - 7} stroke="#e8a33d" strokeWidth="1.6" />
        <text x={PAD_L + 70} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">笔 ·</text>
        <line x1={PAD_L + 90} y1={H_TOTAL - 7} x2={PAD_L + 110} y2={H_TOTAL - 7} stroke="#5ab0ff" strokeWidth="2" strokeDasharray="6,3" />
        <text x={PAD_L + 114} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">线段 ·</text>
        <rect x={PAD_L + 142} y={H_TOTAL - 12} width="14" height="8" fill="rgba(199,146,234,0.2)" stroke="#c792ea" strokeDasharray="3,2" />
        <text x={PAD_L + 160} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">中枢 · B/S 买卖点</text>
      </g>
      {/* hover 十字线 + tooltip */}
      {hover !== null && hoverOpen !== undefined && hoverClose !== undefined && hoverK !== null && (
        <g pointerEvents="none">
          <line x1={x(hover)} y1={8} x2={x(hover)} y2={H_MAIN + H_VOL - 4} stroke="var(--dsw-alias-border-l2)" />
          <circle cx={x(hover)} cy={yMain(hoverK[3] ?? hoverClose)} r="2.5" fill="#e8edef" />
          <g>
            <rect x={W - 218} y={8} width="204" height="58" rx="4" fill="rgba(3,13,11,0.84)" />
            <text x={W - 210} y={22} fontSize="10.5" fill="#e8edef">{dates[hover]?.slice(0, 10) ?? ''}</text>
            <text x={W - 210} y={36} fontSize="10" fill="#e8edef">开 {hoverOpen.toFixed(2)} 收 {hoverClose.toFixed(2)}</text>
            <text x={W - 210} y={49} fontSize="10" fill="#e8edef">低 {hoverK[2]?.toFixed(2) ?? '—'} 高 {hoverK[3]?.toFixed(2) ?? '—'}</text>
            <text x={W - 210} y={61} fontSize="10" fill={hoverPct !== null && hoverPct >= 0 ? '#e05656' : '#2f9e77'}>
              涨跌 {hoverPct !== null ? `${hoverPct >= 0 ? '+' : ''}${hoverPct.toFixed(2)}%` : '—'} · 量 {(volumes[hover] ?? 0) / 10000 >= 100 ? `${((volumes[hover] ?? 0) / 10000).toFixed(0)}万手` : `${((volumes[hover] ?? 0) / 10000).toFixed(1)}万手`}
            </text>
          </g>
        </g>
      )}
    </svg>
  )
}

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

/** 缠论研究页。 */
export function ChanPage({ useWorkspaces }: { useWorkspaces?: UseWorkspaces } = {}) {
  const [stock, setStock] = useState('')
  const [level, setLevel] = useState<string>('daily')
  const [payload, setPayload] = useState<Rec | null>(null)
  const [chart, setChart] = useState<ChartSlice | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingAsk, setPendingAsk] = useState<string | null>(null)

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
      setChart(parseChart(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败')
      setPayload(null)
      setChart(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void analyze('000001', 'daily') }, [analyze])

  const morph = payload !== null ? asRec(payload.morphology) : {}
  const trend = payload !== null ? asRec(payload.trend_analysis) : {}
  const dynamics = payload !== null ? asRec(payload.dynamics) : {}
  const advice = payload !== null ? asRec(payload.trading_advice) : {}
  const scores = payload !== null ? asRec(payload.signal_scores) : {}

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
          <select className="ksq-chan-select" value={level} onChange={event => { setLevel(event.target.value); if (payload !== null) void analyze(stock || asStr(payload.stock_code), event.target.value) }}>
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

        {chart !== null && <ChanChart chart={chart} />}

        {payload !== null && (
          <div className="ksq-chan-summary">
            <div className="ksq-chan-card">
              <strong>形态</strong>
              <span>K线 {asNum(morph.klines_count) ?? '—'} · 分型 {asNum(morph.fenxings_count) ?? '—'}</span>
              <span>笔 {asNum(morph.bis_count) ?? '—'} · 段 {asNum(morph.segs_count) ?? '—'} · 中枢 {asNum(morph.zhongshus_count) ?? '—'}</span>
            </div>
            <div className="ksq-chan-card">
              <strong>走势</strong>
              <span>{asStr(trend.type_cn) || asStr(trend.type) || '—'} · 强度 {asNum(trend.trend_strength) ?? '—'}</span>
              <span>现价 {asNum(trend.latest_price) ?? '—'} · 中枢 {asNum(trend.zhongshu_count) ?? '—'} 个</span>
            </div>
            <div className="ksq-chan-card">
              <strong>买卖点 / 背驰</strong>
              <span>买 {asNum(dynamics.buy_points_count) ?? 0} · 卖 {asNum(dynamics.sell_points_count) ?? 0}</span>
              <span>背驰 {asNum(dynamics.backchi_count) ?? 0} 处</span>
            </div>
            <div className="ksq-chan-card">
              <strong>操作参考</strong>
              <span>{asStr(advice.recommended_action) || '—'}</span>
              <span>入场 {asNum(advice.entry_price)?.toFixed(2) ?? '—'} · 止损 {asNum(advice.stop_loss)?.toFixed(2) ?? '—'} · 目标 {asNum(advice.take_profit)?.toFixed(2) ?? '—'}</span>
            </div>
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
