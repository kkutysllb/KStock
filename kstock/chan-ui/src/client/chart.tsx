/**
 * 缠论主图：K 线 + 笔/段/中枢/买卖点/背驰罩 + 量/MACD 副图。
 * 迁移自 page.tsx 并增强：顶部信息条（现价/涨跌/走势/中枢位置徽章）、
 * 买卖点可靠度环、卡片联动脉冲高亮、hover 结构上下文。
 * 交互保留：滚轮缩放（鼠标锚点）/ 拖拽平移 / 双击复位 / 十字线读值。
 */
import { useEffect, useRef, useState } from 'react'
import {
  asRec, asStr, dateIndexOf, resolveIndex, zhongshuPosition,
  type ChartSlice, type Rec,
} from './derive.ts'

export interface ChartHighlight { kind: 'backchi' | 'point' | 'zhongshu'; id: number }

const W = 720
const H_MAIN = 300
const H_VOL = 56
const PAD_L = 54
const PAD_R = 14
const H_MACD = 62
const H_TOTAL = H_MAIN + H_VOL + H_MACD + 32

export function ChanChart({ chart, payload, view, onViewChange, highlight }: {
  chart: ChartSlice
  payload: Rec
  view: { start: number; count: number }
  onViewChange: React.Dispatch<React.SetStateAction<{ start: number; count: number }>>
  highlight: ChartHighlight | null
}): React.ReactElement {
  const { dates, kline, volumes } = chart
  const total = dates.length
  const svgRef = useRef<SVGSVGElement | null>(null)
  const setView = onViewChange
  const [hover, setHover] = useState<number | null>(null)
  const dragRef = useRef<{ x: number; start: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const clampView = (start: number, count: number): { start: number; count: number } => {
    const c = Math.max(15, Math.min(total, Math.round(count)))
    const st = Math.max(0, Math.min(total - c, Math.round(start)))
    return { start: st, count: c }
  }

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

  const dateIndex = dateIndexOf(dates)
  const indexOfTime = (time: string): number => resolveIndex(dateIndex, time)

  const visK = kline.slice(view.start, winEnd)
  const zsVis = chart.zhongshus.filter(z => {
    const i1 = indexOfTime(z.start_time); const i2 = indexOfTime(z.end_time)
    return i2 >= view.start && i1 <= winEnd
  })
  const lows = visK.map(k => k[2]).concat(zsVis.map(z => z.low))
  const highs = visK.map(k => k[3]).concat(zsVis.map(z => z.high))
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

  // 信息条数据：现价/涨跌幅/走势徽章/中枢位置徽章。
  const trend = asRec(payload.trend_analysis)
  const lastClose = kline.length > 0 ? kline[kline.length - 1]![1] : null
  const prevClose = kline.length > 1 ? kline[kline.length - 2]![1] : null
  const lastPct = lastClose !== null && prevClose !== null && prevClose > 0 ? (lastClose - prevClose) / prevClose * 100 : null
  const lastZs = chart.zhongshus.length > 0 ? chart.zhongshus[chart.zhongshus.length - 1]! : null
  const zsPos = lastZs !== null ? zhongshuPosition(lastClose, lastZs) : null

  // hover 结构上下文：该 K 线处的分型/笔端点/买卖点/中枢事件。
  const hoverContext = hover !== null ? (() => {
    const parts: string[] = []
    const time = dates[hover]?.slice(0, 10) ?? ''
    const fx = chart.fenxings.find(f => f.time.slice(0, 10) === time)
    if (fx !== undefined) parts.push(fx.fenxingType === 'top' ? '顶分型' : '底分型')
    if (chart.biLines.some(b => b.end_time.slice(0, 10) === time)) parts.push('笔端点')
    const mk = chart.markers.find(m => m.time.slice(0, 10) === time)
    if (mk !== undefined) parts.push(`${mk.label ?? mk.type ?? '信号'}`)
    if (chart.zhongshus.some(z => {
      const i1 = indexOfTime(z.start_time); const i2 = indexOfTime(z.end_time)
      return hover >= i1 && hover <= i2
    })) parts.push('中枢内')
    return parts
  })() : []

  const hlClass = (kind: ChartHighlight['kind'], id: number): string =>
    highlight !== null && highlight.kind === kind && highlight.id === id ? 'ksq-chanx-hl' : ''

  return (
    <div className="ksq-chanx-chartcol">
      <div className="ksq-chanx-infobar">
        {lastClose !== null && (
          <>
            <b className={lastPct !== null && lastPct >= 0 ? 'ksq-up' : 'ksq-down'}>{lastClose.toFixed(2)}</b>
            <span className={lastPct !== null && lastPct >= 0 ? 'ksq-up' : 'ksq-down'}>
              {lastPct !== null ? `${lastPct >= 0 ? '+' : ''}${lastPct.toFixed(2)}%` : ''}
            </span>
          </>
        )}
        <span className="ksq-chanx-badge">{asStr(trend.type_cn) || '走势未判定'}</span>
        {zsPos !== null && <span className={`ksq-chanx-badge ${zsPos === 'above' ? 'up' : zsPos === 'below' ? 'down' : ''}`}>中枢{zsPos === 'above' ? '上方' : zsPos === 'below' ? '下方' : '震荡中'}</span>}
        <span className="ksq-item-meta">{asStr(payload.stock_name)} {asStr(payload.stock_code)} · {asStr(payload.time_level)}</span>
      </div>
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
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const price = pMin + pSpan * (1 - ratio)
          return (
            <g key={`grid-${ratio}`}>
              <line x1={PAD_L} y1={yMain(price)} x2={W - PAD_R} y2={yMain(price)} stroke="var(--dsw-alias-border-l3)" strokeDasharray="2,4" />
              <text x={PAD_L - 6} y={yMain(price) + 3} fontSize="10" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">{price.toFixed(2)}</text>
            </g>
          )
        })}
        {chart.backchis.map((bc, i) => {
          const x1 = indexOfTime(bc.previousStart)
          const x2 = indexOfTime(bc.currentEnd)
          if (x1 < 0 || x2 < x1 || x2 < view.start || x1 > winEnd) return null
          return (
            <g key={`bc-${i}`} className={hlClass('backchi', i)}>
              <rect x={x(x1) - slot / 2} y={10} width={(x2 - x1 + 1) * slot} height={H_MAIN - 20}
                fill={bc.valid ? 'url(#ksq-chanx-bcshade)' : 'rgba(230,70,70,0.04)'}
                stroke={bc.valid ? '#e64646' : 'var(--dsw-alias-border-l2)'} strokeWidth="0.8" strokeDasharray="3,4" />
              <text x={Math.max(PAD_L + 2, x(x1) + 3)} y={22} fontSize="9.5" fill={bc.valid ? '#e64646' : 'var(--dsw-alias-label-tertiary)'}>
                {bc.valid ? '背驰段对比' : '背驰未确认'}
              </text>
            </g>
          )
        })}
        <defs>
          <linearGradient id="ksq-chanx-bcshade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(230,70,70,0.16)" />
            <stop offset="100%" stopColor="rgba(230,70,70,0.05)" />
          </linearGradient>
          <linearGradient id="ksq-chanx-zsshade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(199,146,234,0.20)" />
            <stop offset="100%" stopColor="rgba(199,146,234,0.08)" />
          </linearGradient>
        </defs>
        {chart.zhongshus.map((zone, i) => {
          const x1 = indexOfTime(zone.start_time)
          const x2 = indexOfTime(zone.end_time)
          if (x1 < 0 || x2 < x1 || x2 < view.start || x1 > winEnd) return null
          const zoneW = (x2 - x1 + 1) * slot
          return (
            <g key={`zs-${i}`} className={hlClass('zhongshu', i)}>
              {zone.gg !== undefined && zone.dd !== undefined && (
                <rect x={x(x1) - slot / 2} y={yMain(zone.gg)} width={zoneW} height={Math.max(2, yMain(zone.dd) - yMain(zone.gg))} fill="none" stroke="#c792ea" strokeWidth="0.7" strokeDasharray="2,4" opacity="0.65" />
              )}
              <rect x={x(x1) - slot / 2} y={yMain(zone.high)} width={zoneW} height={Math.max(2, yMain(zone.low) - yMain(zone.high))} fill="url(#ksq-chanx-zsshade)" stroke="#c792ea" strokeDasharray="4,3" rx="2" />
              <line x1={x(x1) - slot / 2} y1={yMain(zone.center)} x2={x(x2) + slot / 2} y2={yMain(zone.center)} stroke="#c792ea" strokeWidth="1" strokeDasharray="2,3" />
              <text x={Math.max(PAD_L + 2, x(x1) + 2)} y={yMain(zone.high) - 3} fontSize="9.5" fill="#c792ea">
                中枢 {zone.low.toFixed(2)}~{zone.high.toFixed(2)}{zone.extendCount !== undefined && zone.extendCount > 0 ? ` ·延伸${zone.extendCount}` : ''}{zone.stability !== undefined ? ` ·稳定${zone.stability.toFixed(2)}` : ''}
              </text>
            </g>
          )
        })}
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
        {chart.biLines.map((bi, i) => {
          const x1 = indexOfTime(bi.start_time); const x2 = indexOfTime(bi.end_time)
          if (x1 < 0 || x2 < 0 || x2 < view.start || x1 > winEnd) return null
          return <line key={`bi-${i}`} x1={x(x1)} y1={yMain(bi.start_price)} x2={x(x2)} y2={yMain(bi.end_price)} stroke="#e8a33d" strokeWidth="1.6" opacity="0.85" />
        })}
        {chart.segLines.map((seg, i) => {
          const x1 = indexOfTime(seg.start_time); const x2 = indexOfTime(seg.end_time)
          if (x1 < 0 || x2 < 0 || x2 < view.start || x1 > winEnd) return null
          return <line key={`seg-${i}`} x1={x(x1)} y1={yMain(seg.start_price)} x2={x(x2)} y2={yMain(seg.end_price)} stroke="#5ab0ff" strokeWidth="2.2" strokeDasharray="7,4" opacity="0.9" />
        })}
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
        {chart.markers.map((marker, i) => {
          const index = indexOfTime(marker.time)
          if (index < 0 || index < view.start || index >= winEnd) return null
          const raw = marker.label ?? marker.type ?? '?'
          const isBuy = raw.toUpperCase().includes('BUY') || raw.includes('买')
          const cls = raw.match(/[123]/)?.[0] ?? '?'
          const label = `${isBuy ? 'B' : 'S'}${cls}`
          const color = isBuy ? (cls === '3' ? '#22a06b' : '#31c7a2') : (cls === '3' ? '#c74040' : '#e64646')
          const rel = marker.reliability ?? null
          const ringR = 11
          const circ = 2 * Math.PI * ringR
          return (
            <g key={`mk-${i}`} className={hlClass('point', i)}>
              {rel !== null && (
                <circle cx={x(index)} cy={yMain(marker.price)} r={ringR} fill="none" stroke={color} strokeWidth="1.6"
                  strokeDasharray={`${(Math.max(0, Math.min(1, rel)) * circ).toFixed(1)} ${circ.toFixed(1)}`}
                  transform={`rotate(-90 ${x(index)} ${yMain(marker.price)})`} opacity="0.9" />
              )}
              <circle cx={x(index)} cy={yMain(marker.price)} r="8" fill={color} opacity="0.95" stroke="#fff" strokeWidth="1" />
              <text x={x(index)} y={yMain(marker.price) + 3} fontSize="8.5" textAnchor="middle" fill="#fff" fontWeight="700">{label}</text>
            </g>
          )
        })}
        <line x1={PAD_L} y1={H_MAIN + 4} x2={W - PAD_R} y2={H_MAIN + 4} stroke="var(--dsw-alias-border-l3)" />
        {visK.map((k, offset) => {
          const volume = volumes[view.start + offset] ?? 0
          const up = k[1] >= k[0]
          return (
            <rect key={`v-${view.start + offset}`} x={x(view.start + offset) - Math.max(0.8, slot * 0.32)} y={yVol(volume)} width={Math.max(1.6, slot * 0.64)} height={H_MAIN + 4 + (H_VOL - 10) - yVol(volume)} fill={up ? '#e05656' : '#2f9e77'} opacity="0.55" />
          )
        })}
        <text x={PAD_L - 6} y={H_MAIN + 14} fontSize="9" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">量</text>
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
        {hover !== null && hoverOpen !== undefined && hoverClose !== undefined && hoverK !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} y1={8} x2={x(hover)} y2={H_MAIN + H_VOL - 4} stroke="var(--dsw-alias-border-l2)" />
            <circle cx={x(hover)} cy={yMain(hoverK[3] ?? hoverClose)} r="2.5" fill="#e8edef" />
            <g>
              <rect x={W - 218} y={8} width="204" height={58 + (hoverContext.length > 0 ? 14 : 0)} rx="4" fill="rgba(3,13,11,0.84)" />
              <text x={W - 210} y={22} fontSize="10.5" fill="#e8edef">{dates[hover]?.slice(0, 10) ?? ''}</text>
              <text x={W - 210} y={36} fontSize="10" fill="#e8edef">开 {hoverOpen.toFixed(2)} 收 {hoverClose.toFixed(2)}</text>
              <text x={W - 210} y={49} fontSize="10" fill="#e8edef">低 {hoverK[2]?.toFixed(2) ?? '—'} 高 {hoverK[3]?.toFixed(2) ?? '—'}</text>
              <text x={W - 210} y={61} fontSize="10" fill={hoverPct !== null && hoverPct >= 0 ? '#e05656' : '#2f9e77'}>
                涨跌 {hoverPct !== null ? `${hoverPct >= 0 ? '+' : ''}${hoverPct.toFixed(2)}%` : '—'} · 量 {((volumes[hover] ?? 0) / 10000).toFixed(1)}万手
              </text>
              {hoverContext.length > 0 && (
                <text x={W - 210} y={74} fontSize="9.5" fill="#e8a33d">结构：{hoverContext.join(' · ')}</text>
              )}
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}
