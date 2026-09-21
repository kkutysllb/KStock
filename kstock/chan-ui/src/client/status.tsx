/**
 * 右栏状态：缠论原生七维雷达（替换 czsc 七类）+ 多级别联立矩阵 +
 * 关键位/综合评估 + 折叠的信号明细 chips。
 */
import {
  asArr, asNum, asRec, asStr, latestSignals, trendTypeCn, typeCnDir,
  type MatrixBrief, type RadarDim, type Rec,
} from './derive.ts'

/** 缠论原生雷达：七边形 + 维度值列表（title 悬浮显示计算依据）。 */
export function ChanRadar({ dims, summary }: {
  dims: RadarDim[]
  summary: { score: number | null; direction: 'bullish' | 'bearish' | 'neutral' }
}): React.ReactElement {
  const cx = 78, cy = 72, r = 52
  const angle = (i: number) => (Math.PI * 2 * i) / dims.length - Math.PI / 2
  const point = (i: number, value: number): [number, number] =>
    [cx + Math.cos(angle(i)) * r * value, cy + Math.sin(angle(i)) * r * value]
  const polygon = dims
    .map((d, i) => point(i, d.value !== null ? Math.min(1, Math.max(0.04, d.value / 100)) : 0.04).join(','))
    .join(' ')
  return (
    <div className="ksq-chanx-radarblock">
      <svg viewBox="0 0 156 144" role="img" aria-label="缠论雷达" className="ksq-chanx-radarsvg">
        <title>{`缠论雷达 ${summary.score ?? '—'} 分（${summary.direction === 'bullish' ? '偏多' : summary.direction === 'bearish' ? '偏空' : '中性'}）`}</title>
        {[0.25, 0.5, 0.75, 1].map(ring => (
          <polygon key={ring} points={dims.map((_, i) => point(i, ring).join(',')).join(' ')} fill="none" stroke="var(--dsw-alias-border-l3)" strokeWidth="0.6" />
        ))}
        {dims.map((d, i) => {
          const [px, py] = point(i, 1)
          return <line key={d.key} x1={cx} y1={cy} x2={px} y2={py} stroke="var(--dsw-alias-border-l3)" strokeWidth="0.6" />
        })}
        <polygon points={polygon} fill="rgba(232,163,61,0.28)" stroke="#e8a33d" strokeWidth="1.4" />
        {dims.map((d, i) => {
          const [px, py] = point(i, 1.15)
          return (
            <text key={`l-${d.key}`} x={px} y={py + 3} fontSize="8.5" textAnchor="middle"
              fill={d.value === null ? 'var(--dsw-alias-label-tertiary)' : 'var(--dsw-alias-label-secondary)'}
              opacity={d.value === null ? 0.55 : 1}>
              {d.label}
            </text>
          )
        })}
      </svg>
      <div className="ksq-chanx-radar-meta">
        <strong className={summary.direction === 'bullish' ? 'ksq-chanx-up' : summary.direction === 'bearish' ? 'ksq-chanx-down' : ''}>
          {summary.score !== null ? summary.score.toFixed(1) : '—'} 分 · {summary.direction === 'bullish' ? '偏多' : summary.direction === 'bearish' ? '偏空' : '中性'}
        </strong>
        <ul className="ksq-chanx-dims">
          {dims.map(d => (
            <li key={d.key} title={d.basis}>
              <em>{d.label}</em>
              <b className={d.value === null ? '' : d.value >= 55 ? 'ksq-chanx-up' : d.value <= 45 ? 'ksq-chanx-down' : ''}>
                {d.value !== null ? d.value.toFixed(0) : '—'}
              </b>
            </li>
          ))}
        </ul>
        <span className="ksq-item-meta">悬浮维度看计算依据；缺维退出总分</span>
      </div>
    </div>
  )
}

export interface MatrixRowUI { level: string; status: 'ok' | 'loading' | 'error' | 'empty'; data?: Rec; current?: boolean }

const dirCn = (data: Rec): { cn: string; dir: 'up' | 'down' | 'flat' } => {
  const cn = trendTypeCn(asRec(data.trend_analysis))
  // typeCnDir 命中关键词才返回非 flat，命中即 cn 非空——空串恒 flat → 「未判定」
  const dir = typeCnDir(cn)
  return { cn: cn !== '' ? cn : '未判定', dir }
}

/** 多级别联立矩阵：四行级别 × 方向/买卖点/得分/背驰，多数方向高亮共振。 */
export function LevelMatrix({ rows }: { rows: MatrixRowUI[] }): React.ReactElement {
  const okRows = rows.filter(r => r.status === 'ok' && r.data !== undefined)
  const dirs = okRows.map(r => dirCn(r.data!).dir).filter(d => d !== 'flat')
  const up = dirs.filter(d => d === 'up').length
  const down = dirs.length - up
  // 严格多数才出共振结论：平局与雷达一致率 50% 同口径，不渲染方向徽章/高亮
  const majority: 'up' | 'down' | null = dirs.length >= 2 ? (up > down ? 'up' : down > up ? 'down' : null) : null
  return (
    <div className="ksq-chanx-card">
      <div className="ksq-chanx-card-hd">
        <strong>多级别联立</strong>
        {majority !== null && (
          <span className={`ksq-chanx-badge ${majority === 'up' ? 'up' : 'down'}`}>
            共振{majority === 'up' ? '偏多' : '偏空'}
          </span>
        )}
      </div>
      <table className="ksq-chanx-matrix">
        <thead>
          <tr><th>级别</th><th>方向</th><th>买卖点</th><th>分</th><th>背驰</th></tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const current = row.current === true
            if (row.status !== 'ok' || row.data === undefined) {
              return (
                <tr key={row.level} className={current ? 'cur' : ''}>
                  <td>{row.level}{current ? ' *' : ''}</td>
                  <td colSpan={4} className="ksq-item-meta">
                    {row.status === 'loading' ? '加载中…' : row.status === 'error' ? '加载失败' : '数据不足'}
                  </td>
                </tr>
              )
            }
            const d = row.data
            const { cn, dir } = dirCn(d)
            const dynamics = asRec(d.dynamics)
            const latestPoint = latestSignals(d, 1)[0]
            const score = asNum(asRec(d.signal_scores).final_score)
            const backchi = asNum(dynamics.backchi_count)
            const resonant = majority !== null && dir === majority
            return (
              <tr key={row.level} className={`${current ? 'cur' : ''} ${resonant ? (majority === 'up' ? 'res-up' : 'res-down') : ''}`}>
                <td>{row.level}{current ? ' *' : ''}</td>
                <td className={dir === 'up' ? 'ksq-chanx-up' : dir === 'down' ? 'ksq-chanx-down' : ''}>{cn}</td>
                <td>{latestPoint !== undefined ? asStr(latestPoint.type) || '—' : '—'}</td>
                <td className="ksq-mono">{score !== null ? score.toFixed(0) : '—'}</td>
                <td className="ksq-mono">{backchi !== null ? String(backchi) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <span className="ksq-item-meta">* 当前级别 · 同向行高亮 = 共振；分钟级依赖 tushare 配额</span>
    </div>
  )
}

/** 关键位 + 综合评估（risk/confidence 此前未展示）。 */
export function KeyLevelsCard({ advice, lastZhongshu, assessment }: {
  advice: Rec
  lastZhongshu: { low: number; high: number; center: number } | null
  assessment: Rec
}): React.ReactElement {
  const risk = asNum(assessment.risk_level)
  const confidence = asNum(assessment.confidence_score)
  return (
    <div className="ksq-chanx-card">
      <div className="ksq-chanx-card-hd"><strong>关键位 / 评估</strong></div>
      {lastZhongshu !== null ? (
        <>
          <span className="ksq-chanx-kv">中枢 {lastZhongshu.low.toFixed(2)} ~ {lastZhongshu.high.toFixed(2)}（中轴 {lastZhongshu.center.toFixed(2)}）</span>
          <span className="ksq-item-meta">上沿压力 {lastZhongshu.high.toFixed(2)} · 下沿支撑 {lastZhongshu.low.toFixed(2)}</span>
        </>
      ) : <span className="ksq-item-meta">无中枢数据</span>}
      <span className="ksq-chanx-kv">入场 {asNum(advice.entry_price)?.toFixed(2) ?? '—'} · 止损 {asNum(advice.stop_loss)?.toFixed(2) ?? '—'} · 目标 {asNum(advice.take_profit)?.toFixed(2) ?? '—'}</span>
      <div className="ksq-chanx-relbar">
        <span className="ksq-item-meta">风险</span>
        <span className="ksq-chanx-bar"><i style={{ width: `${(risk ?? 0) * 100}%`, background: '#e64646' }} /></span>
        <b className="ksq-mono">{risk !== null ? risk.toFixed(2) : '—'}</b>
      </div>
      <div className="ksq-chanx-relbar">
        <span className="ksq-item-meta">置信</span>
        <span className="ksq-chanx-bar"><i style={{ width: `${(confidence ?? 0) * 100}%`, background: '#5ab0ff' }} /></span>
        <b className="ksq-mono">{confidence !== null ? confidence.toFixed(2) : '—'}</b>
      </div>
    </div>
  )
}

/** 折叠的信号明细 chips（修复分类后的 czsc 评分详情，默认收起）。 */
export function SignalDetailsCollapsible({ scores }: { scores: Rec }): React.ReactElement {
  const details = asArr(scores.signal_details).map(asRec)
  if (details.length === 0) return <></>
  return (
    <details className="ksq-chanx-chips">
      <summary>信号明细（{details.length}）</summary>
      <div className="ksq-chips">
        {details.map((r, index) => (
          <span key={index} className="ksq-chip ksq-mono">{asStr(r.name)} {asStr(r.value)}</span>
        ))}
      </div>
    </details>
  )
}
