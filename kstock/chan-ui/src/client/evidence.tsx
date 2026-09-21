/**
 * 中栏「动力学×形态学」证据链：推导总链 + 背驰判定卡 + 买卖点证据链卡
 * + 中枢演化卡。全部可点击 → 主图定位并脉冲高亮（onFocus 回调上抛）。
 */
import {
  asNum, asRec, asStr, backchiKind, backchiPriceRelation, dateIndexOf, latestSignals, resolveIndex,
  pointTypeKey, pointWhy, trendTypeCn, zhongshuForecast, zhongshuPosition, zhongshuTypeLabel,
  type ChartHighlight, type ChartSlice, type Rec,
} from './derive.ts'

export interface CardFocusEvent { startIdx: number; endIdx: number; hl: ChartHighlight }
export type FocusHandler = (focus: CardFocusEvent) => void

const backchiTypeCn = (raw: string): string => {
  const kind = backchiKind(raw)
  if (kind === 'top') return '顶背驰'
  if (kind === 'bottom') return '底背驰'
  return '盘整背驰'
}

/** ⓪ 推导总链：segments 用 → 串起的一句话推理（derive.evidenceChain 产出）。 */
export function ChainStrip({ segments }: { segments: string[] }): React.ReactElement {
  return (
    <div className="ksq-chanx-chain">
      {segments.map((seg, i) => (
        <span key={i} className="ksq-chanx-chain-node">{i > 0 && <em aria-hidden>→</em>}{seg}</span>
      ))}
    </div>
  )
}

/** ① 背驰判定卡：MACD 面积对比条 + 价格关系 + 结论徽章。 */
export function BackchiCard({ chart, onFocus }: { chart: ChartSlice | null; onFocus: FocusHandler }): React.ReactElement {
  if (chart === null) {
    return (
      <div className="ksq-chanx-card">
        <div className="ksq-chanx-card-hd"><strong>① 背驰判定</strong><span className="ksq-item-meta">动力学 · MACD 力度对比</span></div>
        <p className="ksq-item-meta">图表数据未就绪。</p>
      </div>
    )
  }
  const di = dateIndexOf(chart.dates)
  const items = chart.backchis
    .map((bc, i) => ({ bc, i }))
    .sort((a, b) => (a.bc.valid === b.bc.valid ? a.i - b.i : a.bc.valid ? -1 : 1))
  return (
    <div className="ksq-chanx-card">
      <div className="ksq-chanx-card-hd"><strong>① 背驰判定</strong><span className="ksq-item-meta">动力学 · MACD 力度对比</span></div>
      {items.length === 0 && <p className="ksq-item-meta">本级别暂无背驰记录（未出现可比较的同向段）。</p>}
      {items.map(({ bc, i }) => {
        const prevArea = bc.previousMacdArea ?? null
        const curArea = bc.currentMacdArea ?? null
        const max = Math.max(prevArea ?? 0, curArea ?? 0, 0.0001)
        const rel = backchiPriceRelation(chart, di, bc)
        return (
          <button
            key={i}
            type="button"
            className={`ksq-chanx-bcrow${bc.valid ? ' valid' : ''}`}
            onClick={() => {
              const s = Math.max(0, resolveIndex(di, bc.previousStart))
              const e0 = resolveIndex(di, bc.currentEnd)
              const e = e0 >= 0 ? e0 : chart.dates.length - 1
              onFocus({ startIdx: s, endIdx: e, hl: { kind: 'backchi', id: i } })
            }}
            title={`定位 ${bc.previousStart.slice(0, 10)} ~ ${bc.currentEnd.slice(0, 10)}`}
          >
            <div className="ksq-chanx-bcrow-hd">
              <span className={`ksq-chanx-badge ${bc.valid ? (backchiKind(bc.backchiType) === 'top' ? 'down' : 'up') : ''}`}>
                {backchiTypeCn(bc.backchiType)} · {bc.valid ? '成立' : '未确认'}
              </span>
              <span className="ksq-item-meta ksq-mono">{bc.currentEnd.slice(0, 10)}</span>
            </div>
            <div className="ksq-chanx-areabars">
              <span className="ksq-item-meta">前段</span>
              <span className="ksq-chanx-bar"><i style={{ width: `${((prevArea ?? 0) / max) * 100}%`, background: 'var(--dsw-alias-border-l2)' }} /></span>
              <b className="ksq-mono">{prevArea !== null ? prevArea.toFixed(3) : '—'}</b>
            </div>
            <div className="ksq-chanx-areabars">
              <span className="ksq-item-meta">现段</span>
              <span className="ksq-chanx-bar"><i style={{ width: `${((curArea ?? 0) / max) * 100}%`, background: '#e05656' }} /></span>
              <b className="ksq-mono">{curArea !== null ? curArea.toFixed(3) : '—'}</b>
            </div>
            <div className="ksq-chanx-bcrow-ft">
              {bc.macdDivergence !== undefined && <span className="ksq-item-meta">力度差 {bc.macdDivergence.toFixed(3)}</span>}
              {rel !== null && (
                <span className="ksq-item-meta">
                  价格 {rel.kind === 'top' ? `${rel.prevHigh.toFixed(2)}→${rel.curHigh.toFixed(2)}${rel.newExtreme ? ' 新高' : ' 未新高'}`
                    : rel.kind === 'bottom' ? `${rel.prevLow.toFixed(2)}→${rel.curLow.toFixed(2)}${rel.newExtreme ? ' 新低' : ' 未新低'}`
                    : '盘整区间对照'}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

/** ② 买卖点证据链卡：类型 + 可靠度条 + 级别确认 + 「为什么」定义行。 */
export function BSPointsCard({ payload, chart, onFocus }: { payload: Rec; chart: ChartSlice | null; onFocus: FocusHandler }): React.ReactElement {
  const di = chart !== null ? dateIndexOf(chart.dates) : null
  const hasValidBackchi = (chart?.backchis ?? []).some(bc => bc.valid)
  /** 动力学 type（中文「一类买点」/枚举 '1buy'）→ 图上 marker 索引（label=BUY_1 形态），找不到返回 -1。 */
  const markerIndexOf = (type: string, time: string): number => {
    const m = /^(\d)(buy|sell)$/.exec(pointTypeKey(type))
    if (m === null) return -1
    const side = m[2] === 'buy' ? 'BUY' : 'SELL'
    return chart?.markers.findIndex(mk =>
      (mk.label ?? '').toUpperCase() === `${side}_${m[1]}` && mk.time.slice(0, 10) === time.slice(0, 10),
    ) ?? -1
  }
  const rows = latestSignals(payload, 6)
  return (
    <div className="ksq-chanx-card">
      <div className="ksq-chanx-card-hd"><strong>② 买卖点证据链</strong><span className="ksq-item-meta">形态 × 动力联立</span></div>
      {rows.length === 0 && <p className="ksq-item-meta">当前级别无买卖点信号。</p>}
      {rows.map(r => {
        const time = asStr(r.timestamp)
        const price = asNum(r.price)
        const rel = asNum(r.reliability)
        const type = asStr(r.type)
        const isBuy = type.includes('buy') || type.includes('买')
        const idx = di !== null ? resolveIndex(di, time.slice(0, 16)) : -1 // 引擎信号时间戳带秒，dates 为分钟粒度——截齐再精确匹配
        return (
          <button
            key={`${time}-${type}`}
            type="button"
            className="ksq-chanx-bsrow"
            disabled={idx < 0}
            onClick={() => {
              if (idx >= 0) onFocus({ startIdx: idx, endIdx: idx, hl: { kind: 'point', id: markerIndexOf(type, time) } })
            }}
          >
            <div className="ksq-chanx-bsrow-hd">
              <span className={`ksq-chanx-badge ${isBuy ? 'up' : 'down'}`}>{type || '信号'}</span>
              <b className="ksq-mono">{price !== null ? price.toFixed(2) : '—'}</b>
              <span className="ksq-item-meta ksq-mono">{time.slice(0, 10)}</span>
            </div>
            <div className="ksq-chanx-relbar" title={`可靠度 ${rel ?? '—'}`}>
              <span className="ksq-item-meta">可靠度</span>
              <span className="ksq-chanx-bar"><i style={{ width: `${(rel ?? 0) * 100}%`, background: isBuy ? '#31c7a2' : '#e64646' }} /></span>
              <b className="ksq-mono">{rel !== null ? rel.toFixed(2) : '—'}</b>
              {r.confirmed_by_higher === true && <span className="ksq-chanx-ok" title="高级别确认">高✓</span>}
              {r.confirmed_by_lower === true && <span className="ksq-chanx-ok" title="低级别确认">低✓</span>}
            </div>
            <div className="ksq-chanx-why">{pointWhy(pointTypeKey(type), hasValidBackchi)}</div>
          </button>
        )
      })}
    </div>
  )
}

/** ③ 中枢演化卡：类型/区间/延伸/稳定度 + 现价位置 + 推演。 */
export function ZhongshuCard({ chart, payload, onFocus }: { chart: ChartSlice | null; payload: Rec; onFocus: FocusHandler }): React.ReactElement {
  if (chart === null || chart.zhongshus.length === 0) {
    return (
      <div className="ksq-chanx-card">
        <div className="ksq-chanx-card-hd"><strong>③ 中枢演化</strong><span className="ksq-item-meta">形态学</span></div>
        <p className="ksq-item-meta">本级别暂无中枢（笔/段尚未构成三段重叠区间）。</p>
      </div>
    )
  }
  const di = dateIndexOf(chart.dates)
  const zones = chart.zhongshus.slice(-2).reverse()
  const lastClose = chart.kline.length > 0 ? chart.kline[chart.kline.length - 1]![1] : null
  const trendCn = trendTypeCn(asRec(payload.trend_analysis))
  return (
    <div className="ksq-chanx-card">
      <div className="ksq-chanx-card-hd"><strong>③ 中枢演化</strong><span className="ksq-item-meta">{trendCn || '形态学'}</span></div>
      {zones.map((zs, i) => {
        const absIdx = chart.zhongshus.length - 1 - i
        const pos = zhongshuPosition(lastClose, zs)
        const s = Math.max(0, resolveIndex(di, zs.start_time))
        const e0 = resolveIndex(di, zs.end_time)
        const e = e0 >= 0 ? e0 : chart.dates.length - 1
        return (
          <button
            key={absIdx}
            type="button"
            className="ksq-chanx-zsrow"
            onClick={() => onFocus({ startIdx: s, endIdx: e, hl: { kind: 'zhongshu', id: absIdx } })}
          >
            <div className="ksq-chanx-bsrow-hd">
              <span className="ksq-chanx-badge zs">{zhongshuTypeLabel(zs.zhongshuType)}中枢{zs.extendCount !== undefined && zs.extendCount > 0 ? ` ·延伸${zs.extendCount}` : ''}</span>
              <b className="ksq-mono">{zs.low.toFixed(2)}~{zs.high.toFixed(2)}</b>
            </div>
            {zs.stability !== undefined && (
              <div className="ksq-chanx-relbar">
                <span className="ksq-item-meta">稳定度</span>
                <span className="ksq-chanx-bar"><i style={{ width: `${zs.stability * 100}%`, background: '#c792ea' }} /></span>
                <b className="ksq-mono">{zs.stability.toFixed(2)}</b>
              </div>
            )}
            <div className="ksq-chanx-zspos">
              <span className={`ksq-chanx-badge ${pos === 'above' ? 'up' : pos === 'below' ? 'down' : ''}`}>
                现价 {lastClose !== null ? lastClose.toFixed(2) : '—'} · {pos === 'above' ? '中枢上方' : pos === 'below' ? '中枢下方' : '震荡带内'}
              </span>
            </div>
            {absIdx === chart.zhongshus.length - 1 && (
              <div className="ksq-chanx-why">{zhongshuForecast(lastClose, zs)}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}
