/**
 * 量化面板共享小件：状态文案、通用折线叠加图、确认弹窗、复制提示。
 * 视觉基调与 1.x 组件一致（语义着色/时间线/浮层），类名换 ksq- 前缀。
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type React from 'react'
import { IconClose, IconRefresh } from './icons.tsx'

/**
 * 图表容器宽度自适应：ResizeObserver 量容器实际宽，SVG 按该宽 1:1 自绘
 * （viewBox 宽 = 渲染宽），宽屏占满卡片、文字保持原始大小不拉伸。
 * 容器不可测（首帧/隐藏）时退 min 宽。
 */
function useContainerWidth(min: number): { ref: React.RefObject<HTMLDivElement>; width: number } {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(min)
  useEffect(() => {
    const el = ref.current
    if (el === null) return
    const update = (): void => {
      const w = Math.round(el.clientWidth)
      if (w > 0) setWidth(Math.max(min, w))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [min])
  return { ref, width }
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('zh-CN', { hour12: false })
}

/** 数值语义着色：收益/夏普为正绿、负红；回撤放大转警示红。 */
export function metricClass(key: string, value: unknown): string {
  if (typeof value !== 'number') return ''
  if (key === 'max_drawdown_pct') return value < -20 ? 'ksq-down' : value < 0 ? 'ksq-warn' : ''
  if (key === 'total_return_pct' || key === 'annual_return_pct' || key === 'sharpe_ratio') {
    return value > 0 ? 'ksq-up' : value < 0 ? 'ksq-down' : ''
  }
  return ''
}

export function metric(run: { metrics?: Record<string, unknown> }, key: string): string {
  const value = run.metrics?.[key]
  if (typeof value === 'number') return String(Math.round(value * 100) / 100)
  return '—'
}

export function statusBadge(status: string): { label: string; tone: string } {
  const map: Record<string, { label: string; tone: string }> = {
    researching: { label: '研究中', tone: 'live' },
    watching: { label: '观察中', tone: 'live' },
    adopted: { label: '已采用', tone: 'live' },
    paused: { label: '已暂停', tone: 'idle' },
    rejected: { label: '已否定', tone: 'bad' },
  }
  return map[status] ?? { label: status, tone: 'idle' }
}

export function ErrorLine({ message }: { message: string }) {
  return <p className="ksq-error" role="alert">{message}</p>
}

export function Loading({ text }: { text: string }) {
  return <p className="ksq-loading">{text}</p>
}

export function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="ksq-empty">
      {icon}
      <strong>{title}</strong>
      <span>{hint}</span>
    </div>
  )
}

/** 刷新按钮（title + 可旋转）。 */
export function RefreshButton({ refreshing, onClick, label }: { refreshing: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="ksq-iconbtn"
      onClick={onClick}
      disabled={refreshing}
      aria-label={label}
      title={label}
    >
      <IconRefresh size={15} className={refreshing ? 'ksq-spin' : undefined} />
    </button>
  )
}

/** 复制到剪贴板 + 底部提示（1.x 的「预填输入框」在引擎 UI 里改为复制交付）。 */
export function useCopyPrompt(): { copy: (text: string) => void; toast: string | null } {
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (toast === null) return
    const timer = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])
  return {
    toast,
    copy: (text) => {
      void navigator.clipboard?.writeText(text).then(
        () => setToast('已复制提示词，粘贴到对话输入框即可让 agent 执行'),
        () => setToast('复制失败，请手动选择文本'),
      )
    },
  }
}

export function CopyToast({ text }: { text: string | null }) {
  if (text === null) return null
  return <div className="ksq-toast" role="status">{text}</div>
}

export interface OverlaySeries {
  label: string
  values: number[]
  color: string
}

export const RUN_COLORS = ['#e8a33d', '#5ab0ff', '#22a06b', '#c792ea', '#e64646', '#8ee6c8']

/**
 * SVG hover 交互层（三图表共用）：把鼠标屏幕坐标换算为绘图区索引
 * （viewBox 缩放换算），越界置 null。
 */
function useSvgHover(width: number, padLeft: number, plotRight: number, maxIndex: number) {
  const [hover, setHover] = useState<number | null>(null)
  const onMove = (event: React.MouseEvent<SVGSVGElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const vx = ((event.clientX - rect.left) / rect.width) * width
    const ratio = (vx - padLeft) / (plotRight - padLeft)
    if (ratio < 0 || ratio > 1) {
      setHover(null)
      return
    }
    setHover(Math.min(maxIndex, Math.max(0, Math.round(ratio * maxIndex))))
  }
  return { hover, onMove, onLeave: () => { setHover(null) } }
}

/** hover tooltip 的半透明底板 + 文本行（动态宽度，防溢出钳位）。 */
function HoverTooltip({ x, y, lines, width }: { x: number; y: number; lines: string[]; width: number }): React.ReactElement {
  const widest = Math.max(...lines.map(line => line.length)) * 6.2 + 12
  const boxH = lines.length * 13 + 8
  const boxX = Math.max(4, Math.min(x, width - widest - 4))
  return (
    <g pointerEvents="none">
      <rect x={boxX} y={y} width={widest} height={boxH} rx="4" fill="rgba(3,13,11,0.82)" />
      {lines.map((line, index) => (
        <text key={line} x={boxX + 6} y={y + 15 + index * 13} fontSize="10.5" fill="#e8edef">{line}</text>
      ))}
    </g>
  )
}

/** 通用多序列折线叠加图（策略净值 / 因子累计 IC 共用，自绘 SVG；
 * hover 十字线 + 圆点 + tooltip，dates 可选提供 x 轴日期标签）。 */
export function LineOverlay({ series, baseline, title, dates }: {
  series: OverlaySeries[]
  baseline?: number
  title: string
  dates?: string[]
}) {
  const { ref, width } = useContainerWidth(560)
  const height = 240
  const padLeft = 46
  const padBottom = 26
  const plotRight = width - 12
  const drawable = series.filter(item => item.values.length >= 2)
  const maxLen = Math.max(2, ...drawable.map(item => item.values.length))
  const all = drawable.flatMap(item => item.values)
  const min = Math.min(...all, baseline ?? Infinity)
  const max = Math.max(...all, baseline ?? -Infinity)
  const span = max - min || 1
  const x = (index: number, length: number) => padLeft + (index / Math.max(1, length - 1)) * (plotRight - padLeft)
  const y = (value: number) => 14 + (1 - (value - min) / span) * (height - padBottom - 14)
  const { hover, onMove, onLeave } = useSvgHover(width, padLeft, plotRight, maxLen - 1)
  if (drawable.length === 0) return null
  return (
    <div ref={ref}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} onMouseMove={onMove} onMouseLeave={onLeave}>
        {baseline !== undefined && (
          <line x1={padLeft} y1={y(baseline)} x2={plotRight} y2={y(baseline)} stroke="var(--dsw-alias-border-l2)" strokeDasharray="3,3" />
        )}
        {baseline !== undefined && (
          <text x={padLeft - 6} y={y(baseline) + 4} fontSize="10" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">
            {baseline.toFixed(2)}
          </text>
        )}
        <text x={padLeft - 6} y={y(max) + 4} fontSize="10" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">{max.toFixed(2)}</text>
        <text x={padLeft - 6} y={y(min) + 4} fontSize="10" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">{min.toFixed(2)}</text>
        {drawable.map(item => (
          <polyline
            key={item.label}
            points={item.values.map((value, index) => `${x(index, item.values.length)},${y(value)}`).join(' ')}
            fill="none"
            stroke={item.color}
            strokeWidth="2"
          />
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover, maxLen)} y1={10} x2={x(hover, maxLen)} y2={height - padBottom} stroke="var(--dsw-alias-border-l2)" />
            {drawable.map(item => {
              const index = Math.min(hover, item.values.length - 1)
              const value = item.values[index]
              if (value === undefined) return null
              return <circle key={`pt-${item.label}`} cx={x(index, item.values.length)} cy={y(value)} r="3" fill={item.color} />
            })}
            <HoverTooltip x={plotRight - 180} y={12} width={width} lines={[
              dates?.[hover] ?? `#${hover + 1}`,
              ...drawable.map(item => {
                const value = item.values[Math.min(hover, item.values.length - 1)]
                return `${item.label}: ${value === undefined ? '—' : value.toFixed(4)}`
              }),
            ]} />
          </g>
        )}
        {drawable.map((item, row) => (
          <g key={`legend-${item.label}`}>
            <rect x={padLeft + row * 150} y={height - 14} width="10" height="10" fill={item.color} />
            <text x={padLeft + row * 150 + 15} y={height - 5} fontSize="11" fill="var(--dsw-alias-label-secondary)">
              {item.label}（{item.values.length === maxLen ? `${item.values.length}pt` : `${item.values.length}/${maxLen}pt`}）
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/** 确认弹窗（删除等破坏性操作）。 */
export function ConfirmDialog({ title, description, confirmText, onConfirm, onCancel }: {
  title: string
  description: string
  confirmText: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="ksq-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onCancel}>
      <div className="ksq-dialog ksq-confirm" onClick={event => event.stopPropagation()}>
        <h3>{title}</h3>
        <p>{description}</p>
        <div className="ksq-confirm-actions">
          <button type="button" className="ksq-btn" onClick={onCancel}>取消</button>
          <button type="button" className="ksq-btn danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}

/** 全屏预览浮层（报告 HTML iframe）。 */
export function PreviewDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="ksq-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ksq-dialog">
        <div className="ksq-dialog-bar">
          <strong>{title}</strong>
          <button type="button" className="ksq-btn" onClick={onClose}>
            <IconClose size={13} /> 关闭
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * 回撤副图（underwater）：输入归一化净值序列，相对 running max 的回撤
 * 百分比向下填充（0 线在顶，红区向下）。回测详情标配——回撤发生在哪、
 * 持续多久、修复耗时一眼可读。
 */
export function DrawdownChart({ values, title, dates }: { values: number[]; title: string; dates?: string[] }): React.ReactElement | null {
  const { ref, width } = useContainerWidth(560)
  const height = 96
  const padLeft = 46
  const plotRight = width - 12
  const { hover, onMove, onLeave } = useSvgHover(width, padLeft, plotRight, Math.max(1, values.length - 1))
  if (values.length < 2) return null
  let peak = -Infinity
  const dd = values.map(value => {
    peak = Math.max(peak, value)
    return peak > 0 ? ((value - peak) / peak) * 100 : 0
  })
  const min = Math.min(...dd, -0.001)
  const x = (index: number) => padLeft + (index / Math.max(1, values.length - 1)) * (plotRight - padLeft)
  const y = (value: number) => 6 + (value / min) * (height - 22) // 0 在顶，min 在底
  const line = dd.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(dd.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`
  const hoverValue = hover !== null ? dd[hover] : null
  if (hoverValue === undefined) return null
  return (
    <div ref={ref}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} onMouseMove={onMove} onMouseLeave={onLeave}>
        <path d={area} fill="rgba(230, 70, 70, 0.28)" />
        <path d={line} fill="none" stroke="#e64646" strokeWidth="1" />
        <line x1={padLeft} y1={y(0)} x2={plotRight} y2={y(0)} stroke="var(--dsw-alias-border-l2)" />
        <text x={padLeft - 6} y={y(0) + 4} fontSize="10" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">0%</text>
        <text x={padLeft - 6} y={height - 8} fontSize="10" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">{min.toFixed(1)}%</text>
        {hover !== null && hoverValue !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} y1={y(0)} x2={x(hover)} y2={height - 18} stroke="var(--dsw-alias-border-l2)" />
            <HoverTooltip x={plotRight - 150} y={4} width={width} lines={[
              dates?.[hover] ?? `#${hover + 1}`,
              `回撤 ${hoverValue.toFixed(2)}%`,
            ]} />
          </g>
        )}
        <text x={padLeft} y={height - 2} fontSize="9.5" fill="var(--dsw-alias-label-tertiary)">最大回撤 {min.toFixed(2)}%（图内重算，供交叉校验）</text>
      </svg>
    </div>
  )
}

/**
 * 每笔交易盈亏柱：0 轴按对称界居中，正绿负红。卖出笔 realized_pnl
 * 序列的分布/连亏段/单笔极值直观呈现。
 */
export function PnlBars({ values, title, labels }: { values: number[]; title: string; labels?: string[] }): React.ReactElement | null {
  const { ref, width } = useContainerWidth(560)
  const height = 110
  const padLeft = 46
  const plotRight = width - 12
  const { hover, onMove, onLeave } = useSvgHover(width, padLeft, plotRight, Math.max(1, values.length - 1))
  if (values.length === 0) return null
  const maxAbs = Math.max(...values.map(v => Math.abs(v)), 0.0001)
  const zeroY = 6 + (height - 26) / 2
  const scale = (height - 26) / 2 / maxAbs
  const slot = (plotRight - padLeft) / values.length
  const barW = Math.max(1, Math.min(38, slot * 0.8))
  return (
    <div ref={ref}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} onMouseMove={onMove} onMouseLeave={onLeave}>
        <line x1={padLeft} y1={zeroY} x2={plotRight} y2={zeroY} stroke="var(--dsw-alias-border-l2)" />
        {values.map((value, index) => {
          const h = Math.max(1, Math.abs(value) * scale)
          const y = value >= 0 ? zeroY - h : zeroY
          return (
            <rect
              key={index}
              x={padLeft + index * slot}
              y={y}
              width={barW}
              height={h}
              fill={value >= 0 ? '#31c7a2' : '#e64646'}
              opacity={hover === index ? 1 : 0.85}
            />
          )
        })}
        {hover !== null && values[hover] !== undefined && (
          <line x1={padLeft + hover * slot + barW / 2} y1={4} x2={padLeft + hover * slot + barW / 2} y2={height - 20} stroke="var(--dsw-alias-border-l2)" />
        )}
        <text x={padLeft - 6} y={zeroY + 4} fontSize="10" textAnchor="end" fill="var(--dsw-alias-label-tertiary)">0</text>
        <text x={padLeft - 6} y={12} fontSize="10" textAnchor="end" fill="#31c7a2">+{maxAbs >= 1000 ? `${(maxAbs / 1000).toFixed(1)}k` : maxAbs.toFixed(0)}</text>
        <text x={padLeft - 6} y={height - 22} fontSize="10" textAnchor="end" fill="#e64646">-{maxAbs >= 1000 ? `${(maxAbs / 1000).toFixed(1)}k` : maxAbs.toFixed(0)}</text>
        {hover !== null && values[hover] !== undefined && (
          <HoverTooltip x={plotRight - 150} y={4} width={width} lines={[
            labels?.[hover] ?? `第 ${hover + 1} 笔`,
            `盈亏 ${values[hover].toLocaleString()}`,
          ]} />
        )}
        <text x={padLeft} y={height - 2} fontSize="9.5" fill="var(--dsw-alias-label-tertiary)">{values.length} 笔平仓（按时间序，绿盈红亏）</text>
      </svg>
    </div>
  )
}
