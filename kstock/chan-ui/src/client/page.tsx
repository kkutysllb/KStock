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
  zhongshus: Array<{ start_time: string; end_time: string; high: number; low: number; center: number; gg?: number; dd?: number; extendCount?: number }>
  markers: Array<Rec>
  macd: { dif: Array<number | null>; dea: Array<number | null>; hist: Array<number | null> }
  fenxings: Array<{ time: string; fenxingType: string; price: number; strength: number }>
  backchis: Array<{ backchiType: string; valid: boolean; currentStart: string; currentEnd: string; previousStart: string; previousEnd: string }>
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
      return { start_time: asStr(r.start_time), end_time: asStr(r.end_time), high: asNum(r.high) ?? 0, low: asNum(r.low) ?? 0, center: asNum(r.center) ?? 0, gg: asNum(r.gg) ?? undefined, dd: asNum(r.dd) ?? undefined, extendCount: asNum(r.extend_count) ?? undefined }
    }),
    markers: asArr(c.markers).map(asRec),
    macd: {
      dif: asArr(asRec(c.macd).dif),
      dea: asArr(asRec(c.macd).dea),
      hist: asArr(asRec(c.macd).hist),
    } as ChartSlice['macd'],
    fenxings: asArr(c.fenxings).map(item => {
      const r = asRec(item)
      return { time: asStr(r.time), fenxingType: asStr(r.fenxing_type), price: asNum(r.price) ?? 0, strength: asNum(r.strength) ?? 0 }
    }),
    backchis: asArr(c.backchis).map(item => {
      const r = asRec(item)
      return { backchiType: asStr(r.backchi_type), valid: r.valid === true, currentStart: asStr(r.current_start), currentEnd: asStr(r.current_end), previousStart: asStr(r.previous_start), previousEnd: asStr(r.previous_end) }
    }),
  }
}

const LEVEL_OPTIONS = ['5min', '15min', '30min', '60min', '90min', '120min', 'daily', 'weekly', 'monthly'] as const
const W = 720
const H_MAIN = 300
const H_VOL = 56
const PAD_L = 54
const PAD_R = 14
const H_MACD = 62
const H_TOTAL = H_MAIN + H_VOL + H_MACD + 32

/**
 * K 线缠论主图（含成交量副图）：滚轮缩放（鼠标为锚）+ 拖拽平移 +
 * 双击复位 + hover 十字线逐根读值。价格轴按可视窗口自适应。
 */
function ChanChart({ chart, view, onViewChange }: { chart: ChartSlice; view: { start: number; count: number }; onViewChange: React.Dispatch<React.SetStateAction<{ start: number; count: number }>> }): React.ReactElement {
  const { dates, kline, volumes } = chart
  const total = dates.length
  const svgRef = useRef<SVGSVGElement | null>(null)
  const setView: React.Dispatch<React.SetStateAction<{ start: number; count: number }>> = onViewChange
  const [hover, setHover] = useState<number | null>(null)
  const dragRef = useRef<{ x: number; start: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const clampView = (start: number, count: number): { start: number; count: number } => {
    const c = Math.max(15, Math.min(total, Math.round(count)))
    const st = Math.max(0, Math.min(total - c, Math.round(start)))
    return { start: st, count: c }
  }

  // 滚轮缩放：鼠标位置为锚（non-passive 监听，阻止页面滚动）。
  useEffect(() => {
    const el = svgRef.current
    if (el === null) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      if (rect.width === 0) return
      const vx = ((event.clientX - rect.left) / rect.width) * W
      const ratio = Math.max(0, Math.min(1, (vx - PAD_L) / (W - PAD_L - PAD_R)))
      setView(current => {
        const anchor = current.start + ratio * current.count
        const factor = event.deltaY < 0 ? 1 / 1.18 : 1.18
        const newCount = current.count * factor
        return clampView(anchor - ratio * newCount, newCount)
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel) }
  }, [total])

  const plotW = W - PAD_L - PAD_R
  const slot = plotW / view.count
  const winEnd = view.start + view.count
  const x = (index: number) => PAD_L + (index - view.start + 0.5) * slot

  // 日期（YYYY-MM-DD 前缀）→ 全局索引。
  const dateIndex = new Map<string, number>()
  dates.forEach((date, index) => dateIndex.set(date.slice(0, 10), index))
  function indexOfTimeLocal(time: string): number {
    return dateIndex.get(time.slice(0, 10)) ?? -1
  }
  const indexOfTime = indexOfTimeLocal

  // 价格轴按可视窗口自适应（窗口内蜡烛 + 相交中枢）。
  const visK = kline.slice(view.start, winEnd)
  const lows = visK.map(k => k[2]).concat(chart.zhongshus.filter(z => {
    const i1 = indexOfTimeLocal(z.start_time); const i2 = indexOfTimeLocal(z.end_time)
    return i2 >= view.start && i1 <= winEnd
  }).map(z => z.low))
  const highs = visK.map(k => k[3]).concat(chart.zhongshus.filter(z => {
    const i1 = indexOfTimeLocal(z.start_time); const i2 = indexOfTimeLocal(z.end_time)
    return i2 >= view.start && i1 <= winEnd
  }).map(z => z.high))
  const pMin = Math.min(...lows)
  const pMax = Math.max(...highs)
  const pSpan = pMax - pMin || 1
  const vMax = Math.max(...volumes.slice(view.start, winEnd), 1)
  const yMain = (price: number) => 12 + (1 - (price - pMin) / pSpan) * (H_MAIN - 26)
  const yVol = (volume: number) => H_MAIN + 4 + (1 - volume / vMax) * (H_VOL - 10)

  const vxOf = (event: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>): number => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect === undefined || rect.width === 0) return -1
    return ((event.clientX - rect.left) / rect.width) * W
  }

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    const vx = vxOf(event)
    if (vx < PAD_L) return
    dragRef.current = { x: vx, start: view.start }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    const vx = vxOf(event)
    if (vx < 0) return
    if (dragRef.current !== null) {
      const deltaIdx = -(vx - dragRef.current.x) / slot
      setView(clampView(dragRef.current.start + deltaIdx, view.count))
      return
    }
    const index = Math.floor((vx - PAD_L) / slot) + view.start
    setHover(index >= view.start && index < winEnd ? index : null)
  }

  const endDrag = (): void => {
    dragRef.current = null
    setDragging(false)
  }

  const hoverK = hover !== null ? kline[hover] ?? null : null
  const hoverOpen = hoverK?.[0]
  const hoverClose = hoverK?.[1]
  const hoverPct = hoverOpen !== undefined && hoverOpen > 0 && hoverClose !== undefined ? ((hoverClose - hoverOpen) / hoverOpen * 100) : null

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H_TOTAL}`}
      role="img"
      aria-label="缠论 K 线结构图"
      style={{ cursor: dragging ? 'grabbing' : 'crosshair', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={() => { endDrag(); setHover(null) }}
      onDoubleClick={() => { setView({ start: 0, count: total }); setHover(null) }}
    >
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
      {/* 背驰罩（valid 背驰：previous_start→current_end 区间半透明罩） */}
      {chart.backchis.filter(bc => bc.valid).map((bc, i) => {
        const x1 = indexOfTime(bc.previousStart)
        const x2 = indexOfTime(bc.currentEnd)
        if (x1 < 0 || x2 < x1 || x2 < view.start || x1 > winEnd) return null
        return (
          <g key={`bc-${i}`}>
            <rect x={x(x1) - slot / 2} y={10} width={(x2 - x1 + 1) * slot} height={H_MAIN - 20} fill="rgba(230,70,70,0.07)" stroke="#e64646" strokeWidth="0.8" strokeDasharray="3,4" />
            <text x={Math.max(PAD_L + 2, x(x1) + 3)} y={22} fontSize="9.5" fill="#e64646">背驰段对比</text>
          </g>
        )
      })}
      {/* 中枢双层（GG/DD 震荡区间外虚线框 + ZG/ZD 中枢区间实框） */}
      {chart.zhongshus.map((zone, i) => {
        const x1 = indexOfTime(zone.start_time)
        const x2 = indexOfTime(zone.end_time)
        if (x1 < 0 || x2 < x1 || x2 < view.start || x1 > winEnd) return null
        const zoneW = (x2 - x1 + 1) * slot
        return (
          <g key={`zs-${i}`}>
            {zone.gg !== undefined && zone.dd !== undefined && (
              <rect x={x(x1) - slot / 2} y={yMain(zone.gg)} width={zoneW} height={Math.max(2, yMain(zone.dd) - yMain(zone.gg))} fill="none" stroke="#c792ea" strokeWidth="0.7" strokeDasharray="2,4" opacity="0.65" />
            )}
            <rect x={x(x1) - slot / 2} y={yMain(zone.high)} width={zoneW} height={Math.max(2, yMain(zone.low) - yMain(zone.high))} fill="rgba(199,146,234,0.14)" stroke="#c792ea" strokeDasharray="4,3" rx="2" />
            <line x1={x(x1) - slot / 2} y1={yMain(zone.center)} x2={x(x2) + slot / 2} y2={yMain(zone.center)} stroke="#c792ea" strokeWidth="1" strokeDasharray="2,3" />
            <text x={Math.max(PAD_L + 2, x(x1) + 2)} y={yMain(zone.high) - 3} fontSize="9.5" fill="#c792ea">
              中枢 {zone.low.toFixed(2)}~{zone.high.toFixed(2)}{zone.extendCount !== undefined && zone.extendCount > 0 ? ` ·延伸${zone.extendCount}` : ''}{zone.gg !== undefined && zone.dd !== undefined ? ` ·震荡 ${zone.dd.toFixed(2)}~${zone.gg.toFixed(2)}` : ''}
            </text>
          </g>
        )
      })}
      {/* 蜡烛（仅窗口内） */}
      {visK.map((k, offset) => {
        const index = view.start + offset
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
      {/* 笔（半透明折线；窗口相交即画） */}
      {chart.biLines.map((bi, i) => {
        const x1 = indexOfTime(bi.start_time); const x2 = indexOfTime(bi.end_time)
        if (x1 < 0 || x2 < 0 || x2 < view.start || x1 > winEnd) return null
        return <line key={`bi-${i}`} x1={x(x1)} y1={yMain(bi.start_price)} x2={x(x2)} y2={yMain(bi.end_price)} stroke="#e8a33d" strokeWidth="1.6" opacity="0.85" />
      })}
      {/* 线段（更粗虚线） */}
      {chart.segLines.map((seg, i) => {
        const x1 = indexOfTime(seg.start_time); const x2 = indexOfTime(seg.end_time)
        if (x1 < 0 || x2 < 0 || x2 < view.start || x1 > winEnd) return null
        return <line key={`seg-${i}`} x1={x(x1)} y1={yMain(seg.start_price)} x2={x(x2)} y2={yMain(seg.end_price)} stroke="#5ab0ff" strokeWidth="2.2" strokeDasharray="7,4" opacity="0.9" />
      })}
      {/* 分型三角（顶▲底▼，窗口内；缩放后自动显现细节） */}
      {chart.fenxings.map((fx, i) => {
        const index = indexOfTime(fx.time)
        if (index < 0 || index < view.start || index >= winEnd) return null
        const isTop = fx.fenxingType === 'top'
        const py = isTop ? yMain(chart.kline[index]?.[3] ?? fx.price) : yMain(chart.kline[index]?.[2] ?? fx.price)
        const dir = isTop ? 1 : -1
        return (
          <g key={`fx-${i}`} opacity={view.count > 60 ? 0.45 : 0.9}>
            <path d={`M${x(index)},${py - dir * 5} l-4,${dir * 6} l8,0 Z`} fill={isTop ? '#e64646' : '#2f9e77'} />
          </g>
        )
      })}
      {/* 买卖点徽章（一二三类分类：B1/B2/B3/S1/S2/S3） */}
      {chart.markers.map((marker, i) => {
        const time = asStr(marker.time ?? marker.date)
        const index = indexOfTime(time)
        const price = asNum(marker.price)
        if (index < 0 || price === null || index < view.start || index >= winEnd) return null
        const raw = asStr(marker.label ?? marker.type ?? '?')
        const isBuy = raw.toUpperCase().includes('BUY') || raw.includes('买')
        const cls = raw.match(/[123]/)?.[0] ?? '?'
        const label = `${isBuy ? 'B' : 'S'}${cls}`
        const color = isBuy ? (cls === '3' ? '#22a06b' : '#31c7a2') : (cls === '3' ? '#c74040' : '#e64646')
        return (
          <g key={`mk-${i}`}>
            <circle cx={x(index)} cy={yMain(price)} r="8" fill={color} opacity="0.95" stroke="#fff" strokeWidth="1" />
            <text x={x(index)} y={yMain(price) + 3} fontSize="8.5" textAnchor="middle" fill="#fff" fontWeight="700">{label}</text>
          </g>
        )
      })}
      {/* 成交量副图（仅窗口内） */}
      <line x1={PAD_L} y1={H_MAIN + 4} x2={W - PAD_R} y2={H_MAIN + 4} stroke="var(--dsw-alias-border-l3)" />
      {visK.map((k, offset) => {
        const volume = volumes[view.start + offset] ?? 0
        const up = k[1] >= k[0]
        return (
          <rect key={`v-${view.start + offset}`} x={x(view.start + offset) - Math.max(0.8, slot * 0.32)} y={yVol(volume)} width={Math.max(1.6, slot * 0.64)} height={H_MAIN + 4 + (H_VOL - 10) - yVol(volume)} fill={up ? '#e05656' : '#2f9e77'} opacity="0.55" />
        )
      })}
      <text x={PAD_L - 6} y={H_MAIN + 14} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">量</text>
      {/* MACD 副图（窗口切片：hist 柱 + DIF/DEA 线 + 零轴；背驰判定的核心工具） */}
      {(() => {
        const yMacdTop = H_MAIN + H_VOL + 6
        const hMacd = H_MACD - 12
        const windowHist = chart.macd.hist.slice(view.start, winEnd).map(v => v ?? 0)
        const windowDif = chart.macd.dif.slice(view.start, winEnd).map(v => v ?? 0)
        const windowDea = chart.macd.dea.slice(view.start, winEnd).map(v => v ?? 0)
        const mAbs = Math.max(...windowHist, ...windowDif, ...windowDea, 0.0001)
        const yM = (value: number) => yMacdTop + hMacd / 2 - (value / mAbs) * (hMacd / 2 - 2)
        const zeroY = yM(0)
        return (
          <g>
            <line x1={PAD_L} y1={yMacdTop - 2} x2={W - PAD_R} y2={yMacdTop - 2} stroke="var(--dsw-alias-border-l3)" />
            <line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke="var(--dsw-alias-border-l2)" strokeDasharray="2,3" />
            <text x={PAD_L - 6} y={zeroY + 3} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">0</text>
            <text x={PAD_L - 6} y={yMacdTop + 8} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">{mAbs.toFixed(2)}</text>
            <text x={PAD_L - 6} y={yMacdTop + hMacd} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">-{mAbs.toFixed(2)}</text>
            {windowHist.map((value, offset) => {
              const index = view.start + offset
              const h = Math.abs(yM(value) - zeroY)
              return <rect key={`mh-${index}`} x={x(index) - Math.max(0.8, slot * 0.3)} y={value >= 0 ? zeroY - h : zeroY} width={Math.max(1.6, slot * 0.6)} height={Math.max(0.6, h)} fill={value >= 0 ? '#e05656' : '#2f9e77'} opacity="0.6" />
            })}
            <polyline points={windowDif.map((value, offset) => `${x(view.start + offset)},${yM(value)}`).join(' ')} fill="none" stroke="#e8a33d" strokeWidth="1.1" />
            <polyline points={windowDea.map((value, offset) => `${x(view.start + offset)},${yM(value)}`).join(' ')} fill="none" stroke="#5ab0ff" strokeWidth="1.1" />
            <text x={PAD_L + 2} y={yMacdTop + 10} fontSize="9" fill="#e8a33d">DIF</text>
            <text x={PAD_L + 24} y={yMacdTop + 10} fontSize="9" fill="#5ab0ff">DEA</text>
          </g>
        )
      })()}
      {/* 图例 */}
      <g fontSize="9.5">
        <text x={PAD_L} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">红涨绿跌 ·</text>
        <line x1={PAD_L + 46} y1={H_TOTAL - 7} x2={PAD_L + 66} y2={H_TOTAL - 7} stroke="#e8a33d" strokeWidth="1.6" />
        <text x={PAD_L + 70} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">笔 ·</text>
        <line x1={PAD_L + 90} y1={H_TOTAL - 7} x2={PAD_L + 110} y2={H_TOTAL - 7} stroke="#5ab0ff" strokeWidth="2" strokeDasharray="6,3" />
        <text x={PAD_L + 114} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">线段 ·</text>
        <rect x={PAD_L + 142} y={H_TOTAL - 12} width="14" height="8" fill="rgba(199,146,234,0.2)" stroke="#c792ea" strokeDasharray="3,2" />
        <text x={PAD_L + 160} y={H_TOTAL - 4} fill="var(--dsw-alias-label-tertiary)">中枢 · 滚轮缩放 · 拖拽平移 · 双击复位</text>
        <text x={W - PAD_R} y={H_TOTAL - 4} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">{view.start + 1}-{winEnd}/{total}</text>
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
              涨跌 {hoverPct !== null ? `${hoverPct >= 0 ? '+' : ''}${hoverPct.toFixed(2)}%` : '—'} · 量 {((volumes[hover] ?? 0) / 10000).toFixed(1)}万手
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
    const dateIndex = new Map<string, number>()
    chart.dates.forEach((date, index) => dateIndex.set(date.slice(0, 10), index))
    for (const marker of chart.markers) {
      const time = asStr(marker.time ?? marker.date)
      const index = dateIndex.get(time.slice(0, 10)) ?? -1
      if (index >= 0) {
        signalRows.push({ key: `m-${index}-${asStr(marker.label)}`, date: time.slice(0, 10), label: asStr(marker.label ?? marker.type ?? '信号'), price: asNum(marker.price), index })
      }
    }
    for (const bi of chart.biLines.slice(-6).reverse()) {
      const endIndex = dateIndex.get(bi.end_time.slice(0, 10)) ?? -1
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

        {payload !== null && (
          <div className="ksq-chan-main">
            <div className="ksq-chan-chartwrap">
              {chart !== null && <ChanChart chart={chart} view={view} onViewChange={setView} />}
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
