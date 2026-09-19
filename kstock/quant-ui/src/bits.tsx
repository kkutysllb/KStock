/**
 * 量化面板共享小件：状态文案、通用折线叠加图、确认弹窗、复制提示。
 * 视觉基调与 1.x 组件一致（语义着色/时间线/浮层），类名换 ksq- 前缀。
 */

import { useEffect, useState, type ReactNode } from 'react'
import { IconClose, IconRefresh } from './icons.tsx'

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

/** 通用多序列折线叠加图（策略净值 / 因子累计 IC 共用，自绘 SVG）。 */
export function LineOverlay({ series, baseline, title }: { series: OverlaySeries[]; baseline?: number; title: string }) {
  const drawable = series.filter(item => item.values.length >= 2)
  if (drawable.length === 0) return null
  const width = 560
  const height = 240
  const padLeft = 46
  const padBottom = 26
  const maxLen = Math.max(...drawable.map(item => item.values.length))
  const all = drawable.flatMap(item => item.values)
  const min = Math.min(...all, baseline ?? Infinity)
  const max = Math.max(...all, baseline ?? -Infinity)
  const span = max - min || 1
  const x = (index: number, length: number) => padLeft + (index / Math.max(1, length - 1)) * (width - padLeft - 12)
  const y = (value: number) => 14 + (1 - (value - min) / span) * (height - padBottom - 14)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
      {baseline !== undefined && (
        <line x1={padLeft} y1={y(baseline)} x2={width - 12} y2={y(baseline)} stroke="var(--dsw-alias-border-l2)" strokeDasharray="3,3" />
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
      {drawable.map((item, row) => (
        <g key={`legend-${item.label}`}>
          <rect x={padLeft + row * 120} y={height - 14} width="10" height="10" fill={item.color} />
          <text x={padLeft + row * 120 + 15} y={height - 5} fontSize="11" fill="var(--dsw-alias-label-secondary)">
            {item.label}（{item.values.length === maxLen ? `${item.values.length}pt` : `${item.values.length}/${maxLen}pt`}）
          </text>
        </g>
      ))}
    </svg>
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
