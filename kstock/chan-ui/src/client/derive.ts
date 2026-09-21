/**
 * 缠论面板纯逻辑层：引擎 JSON 解析 + 派生计算（雷达维度/背驰价格关系/
 * 中枢位置/证据链拼装）。无 React 依赖，node:test 直测。
 */

/** 引擎 JSON 的宽松取值助手。 */
export type Rec = Record<string, unknown>
export const asRec = (v: unknown): Rec => (typeof v === 'object' && v !== null ? v as Rec : {})
export const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
export const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
export const asStr = (v: unknown): string => (typeof v === 'string' ? v : '')

export const LEVEL_OPTIONS = ['5min', '15min', '30min', '60min', '90min', '120min', 'daily', 'weekly', 'monthly'] as const

/** 联立矩阵四行窗口：当前级别 + 低一档（若有）+ 高两档；边界向另一侧顺延。 */
export function matrixLevels(level: string): string[] {
  const opts = LEVEL_OPTIONS as readonly string[]
  const idx = opts.indexOf(level)
  const cur = idx >= 0 ? idx : opts.indexOf('daily')
  const start = Math.max(0, Math.min(cur - 1, opts.length - 4))
  return opts.slice(start, start + 4)
}

export interface BiLine { start_time: string; end_time: string; start_price: number; end_price: number; direction?: string }
export interface SegLine { start_time: string; end_time: string; start_price: number; end_price: number }
export interface ZhongshuZone {
  start_time: string; end_time: string; high: number; low: number; center: number
  gg?: number; dd?: number; extendCount?: number; zhongshuType?: string; stability?: number
}
export interface Fenxing { time: string; fenxingType: string; price: number; strength: number }
export interface Backchi {
  backchiType: string; valid: boolean
  currentStart: string; currentEnd: string; previousStart: string; previousEnd: string
  currentMacdArea?: number; previousMacdArea?: number; macdDivergence?: number
}
export interface ChartMarker {
  time: string; price: number; type?: string; label?: string
  reliability?: number; strength?: number; confirmedByHigher?: boolean; confirmedByLower?: boolean
}
export interface ChartSlice {
  dates: string[]
  kline: Array<[number, number, number, number]>
  volumes: number[]
  biLines: BiLine[]
  segLines: SegLine[]
  zhongshus: ZhongshuZone[]
  markers: ChartMarker[]
  macd: { dif: Array<number | null>; dea: Array<number | null>; hist: Array<number | null> }
  fenxings: Fenxing[]
  backchis: Backchi[]
}

/** 引擎 payload → 图表切片（宽松解析，字段缺失给安全默认）。 */
export function parseChart(payload: Rec): ChartSlice | null {
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
      return {
        start_time: asStr(r.start_time), end_time: asStr(r.end_time),
        high: asNum(r.high) ?? 0, low: asNum(r.low) ?? 0, center: asNum(r.center) ?? 0,
        gg: asNum(r.gg) ?? undefined, dd: asNum(r.dd) ?? undefined,
        extendCount: asNum(r.extend_count) ?? undefined,
        zhongshuType: asStr(r.zhongshu_type) || undefined,
        stability: asNum(r.stability) ?? undefined,
      }
    }),
    markers: asArr(c.markers).map(item => {
      const r = asRec(item)
      return {
        time: asStr(r.time) || asStr(r.date), price: asNum(r.price) ?? 0,
        type: asStr(r.type) || undefined, label: asStr(r.label) || undefined,
        reliability: asNum(r.reliability) ?? undefined, strength: asNum(r.strength) ?? undefined,
        confirmedByHigher: r.confirmed_by_higher === true, confirmedByLower: r.confirmed_by_lower === true,
      }
    }),
    macd: {
      dif: asArr(asRec(c.macd).dif).map(asNum),
      dea: asArr(asRec(c.macd).dea).map(asNum),
      hist: asArr(asRec(c.macd).hist).map(asNum),
    },
    fenxings: asArr(c.fenxings).map(item => {
      const r = asRec(item)
      return { time: asStr(r.time), fenxingType: asStr(r.fenxing_type), price: asNum(r.price) ?? 0, strength: asNum(r.strength) ?? 0 }
    }),
    backchis: asArr(c.backchis).map(item => {
      const r = asRec(item)
      return {
        backchiType: asStr(r.backchi_type), valid: r.valid === true,
        currentStart: asStr(r.current_start), currentEnd: asStr(r.current_end),
        previousStart: asStr(r.previous_start), previousEnd: asStr(r.previous_end),
        currentMacdArea: asNum(r.current_macd_area) ?? undefined,
        previousMacdArea: asNum(r.previous_macd_area) ?? undefined,
        macdDivergence: asNum(r.macd_divergence) ?? undefined,
      }
    }),
  }
}

/** 时间 → 全局索引表：同时建全时间戳精确键与日期前缀兜底键。 */
export function dateIndexOf(dates: string[]): Map<string, number> {
  const map = new Map<string, number>()
  dates.forEach((date, index) => {
    map.set(date, index)                 // 全时间戳精确键（引擎笔/段/中枢/买卖点时间与 K 线同格式）
    map.set(date.slice(0, 10), index)    // 日期前缀兜底（同日折叠，后写胜出；仅日线级精确）
  })
  return map
}

/** 时间 → 索引：先按全时间戳精确匹配，再退日期前缀（分钟级同日多根时避免整日误吸附）。 */
export function resolveIndex(map: Map<string, number>, time: string): number {
  return map.get(time) ?? map.get(time.slice(0, 10)) ?? -1
}

// ── 背驰价格关系 ─────────────────────────────────────────────────────────

/** 背驰类型关键词 → 方向（顶/底/未知=盘整类）。 */
export function backchiKind(backchiType: string): 'top' | 'bottom' | null {
  const t = backchiType.toLowerCase()
  if (t.includes('top') || backchiType.includes('顶')) return 'top'
  if (t.includes('bottom') || backchiType.includes('底')) return 'bottom'
  return null
}

export interface PriceRelation {
  prevHigh: number; prevLow: number; curHigh: number; curLow: number
  newExtreme: boolean; kind: 'top' | 'bottom' | null
}

/** 前段 vs 现段的价格极值对照：顶背驰看新高、底背驰看新低（动力学缺了形态对照就是半句话）。 */
export function backchiPriceRelation(chart: ChartSlice, dateIndex: Map<string, number>, bc: Backchi): PriceRelation | null {
  const range = (start: string, end: string): Array<[number, number, number, number]> | null => {
    const i1 = resolveIndex(dateIndex, start)
    const i2 = resolveIndex(dateIndex, end)
    if (i1 < 0 || i2 < 0 || i2 < i1) return null
    return chart.kline.slice(i1, i2 + 1)
  }
  const prev = range(bc.previousStart, bc.previousEnd)
  const cur = range(bc.currentStart, bc.currentEnd)
  if (prev === null || cur === null || prev.length === 0 || cur.length === 0) return null
  const highs = (ks: typeof cur) => Math.max(...ks.map(k => k[3]))
  const lows = (ks: typeof cur) => Math.min(...ks.map(k => k[2]))
  const kind = backchiKind(bc.backchiType)
  const prevHigh = highs(prev); const curHigh = highs(cur)
  const prevLow = lows(prev); const curLow = lows(cur)
  return {
    prevHigh, prevLow, curHigh, curLow,
    newExtreme: kind === 'top' ? curHigh > prevHigh : kind === 'bottom' ? curLow < prevLow : false,
    kind,
  }
}

// ── 中枢位置与推演 ───────────────────────────────────────────────────────

export function zhongshuPosition(price: number | null, zs: ZhongshuZone): 'above' | 'inside' | 'below' | null {
  if (price === null) return null
  const top = zs.gg ?? zs.high
  const bottom = zs.dd ?? zs.low
  if (price > top) return 'above'
  if (price < bottom) return 'below'
  return 'inside'
}

/** 下一步推演：按现价相对中枢/震荡带位置给出规则文案（数字随区间动态嵌入）。 */
export function zhongshuForecast(price: number | null, zs: ZhongshuZone): string {
  const pos = zhongshuPosition(price, zs)
  const top = zs.gg ?? zs.high
  const bottom = zs.dd ?? zs.low
  const f = (v: number) => v.toFixed(2)
  if (pos === 'above') return `已上破震荡上沿 GG ${f(top)}：回踩不破 ZG ${f(zs.high)} → 三买成立`
  if (pos === 'below') return `已跌破震荡下沿 DD ${f(bottom)}：反抽不回中枢 → 中枢下移/走势转弱`
  if (price !== null && price > zs.high) return `中枢上沿区内：放量破 GG ${f(top)} → 三买观察`
  if (price !== null && price < zs.low) return `中枢下沿区内：跌破 DD ${f(bottom)} → 防中枢下移`
  return `中枢震荡中：关注 GG ${f(top)} / DD ${f(bottom)} 的突破方向`
}

// ── 缠论原生雷达 ─────────────────────────────────────────────────────────

export interface RadarDim { key: string; label: string; value: number | null; basis: string }
export interface MatrixBrief { status: 'ok' | 'loading' | 'error'; data?: Rec }

const clamp100 = (v: number) => Math.max(0, Math.min(100, v))

/** 七维合成（详见规格 §4.2，每维 basis 说明计算依据；数据缺失 → null 退出总分）。 */
export function radarDims(payload: Rec, matrixRows: MatrixBrief[]): RadarDim[] {
  const morph = asRec(payload.morphology)
  const trend = asRec(payload.trend_analysis)
  const c = asRec(payload.chart_data)
  const klines = asNum(morph.klines_count) ?? 0
  const processed = asNum(morph.processed_klines_count) ?? 0
  const bis = asNum(morph.bis_count) ?? 0
  const segs = asNum(morph.segs_count) ?? 0
  const fxs = asNum(morph.fenxings_count) ?? 0
  const zsList = asArr(c.zhongshu_zones).map(asRec)
  const backchis = asArr(c.backchis).map(asRec)

  const dims: RadarDim[] = []

  { // 形态完整度：处理保留率 / 分型对笔充足率(理想≈2:1) / 笔对段充足率(理想≈3:1)
    const a = klines > 0 ? Math.min(1, processed / klines) : 0
    const b = bis > 0 ? Math.min(1, fxs / (bis * 2)) : 0
    const d = segs > 0 ? Math.min(1, bis / (segs * 3)) : (bis > 0 ? 0.5 : 0)
    const value = klines > 0 && bis > 0 ? clamp100(((a + b + d) / 3) * 100) : null
    dims.push({ key: 'morph-integrity', label: '形态完整度', value, basis: `处理保留 ${processed}/${klines} · 分型/笔 ${fxs}/${bis} · 笔/段 ${bis}/${segs}` })
  }

  { // 中枢稳定度：最新中枢 stability
    const last = zsList.length > 0 ? zsList[zsList.length - 1]! : null
    const stab = last !== null ? asNum(last.stability) : null
    dims.push({ key: 'zs-stability', label: '中枢稳定度', value: stab !== null ? clamp100(stab * 100) : null, basis: last !== null ? `最新中枢稳定度 ${stab ?? '—'}` : '本级别无中枢数据' })
  }

  { // 走势强度
    const strength = asNum(trend.trend_strength)
    dims.push({ key: 'trend-strength', label: '走势强度', value: strength !== null ? clamp100(strength * 100) : null, basis: `trend_strength=${strength ?? '—'}（${asStr(trend.type_cn) || '未判定'}）` })
  }

  { // 背驰压力：顶背驰记空方压力、底背驰记多方承接（±每处最多 30 分）
    let adj = 0
    let count = 0
    for (const bc of backchis) {
      if (bc.valid !== true) continue
      count += 1
      const kind = backchiKind(asStr(bc.backchi_type))
      const div = Math.abs(asNum(bc.macd_divergence) ?? 0)
      const magnitude = Math.min(30, div * 200)
      adj += kind === 'top' ? -magnitude : kind === 'bottom' ? magnitude : 0
    }
    dims.push({ key: 'backchi-pressure', label: '背驰压力', value: count > 0 ? clamp100(50 + adj) : null, basis: count > 0 ? `有效背驰 ${count} 处（顶=空方/底=多方），净调整 ${adj.toFixed(0)}` : '无有效背驰' })
  }

  { // 买卖点质量：最新信号可靠度
    const latest = asArr(payload.latest_signals).map(asRec)[0] ?? null
    const rel = latest !== null ? asNum(latest.reliability) : null
    dims.push({ key: 'bs-quality', label: '买卖点质量', value: rel !== null ? clamp100(rel * 100) : null, basis: latest !== null ? `最新信号 ${asStr(latest.type)} 可靠度 ${rel ?? '—'}` : '近期无买卖点信号' })
  }

  { // 级别共振：矩阵 ok 行方向多数一致率（<2 ok 行 → null）
    type Dir = 'up' | 'down' | 'flat'
    const dirOf = (data: Rec): Dir => {
      const cn = asStr(asRec(data.trend_analysis).type_cn)
      if (cn.includes('上涨') || cn.includes('多')) return 'up'
      if (cn.includes('下跌') || cn.includes('空')) return 'down'
      return 'flat'
    }
    const dirs = matrixRows.filter(r => r.status === 'ok' && r.data !== undefined).map(r => dirOf(r.data!))
    const directional = dirs.filter(d => d !== 'flat')
    if (directional.length >= 2) {
      const up = directional.filter(d => d === 'up').length
      const majority = Math.max(up, directional.length - up)
      dims.push({ key: 'level-resonance', label: '级别共振', value: clamp100((majority / directional.length) * 100), basis: `联立 ${directional.length}/${dirs.length} 行有方向，一致率 ${Math.round((majority / directional.length) * 100)}%` })
    } else {
      dims.push({ key: 'level-resonance', label: '级别共振', value: null, basis: '有方向级别的行不足 2 行' })
    }
  }

  { // 量能配合：近 20 根涨/跌放量对比
    const kline = asArr(c.kline).map(asArr)
    const vols = asArr(c.volumes).map(v => asNum(v) ?? 0)
    const n = Math.min(20, kline.length, vols.length)
    if (n >= 6) {
      let up = 0; let down = 0
      for (let i = kline.length - n; i < kline.length; i += 1) {
        const close = Number(kline[i]?.[1] ?? 0); const open = Number(kline[i]?.[0] ?? 0)
        if (close >= open) up += vols[i] ?? 0
        else down += vols[i] ?? 0
      }
      const bias = up + down > 0 ? (up - down) / (up + down) : 0
      dims.push({ key: 'volume-fit', label: '量能配合', value: clamp100(50 + bias * 80), basis: `近 ${n} 根上涨量/下跌量偏移 ${(bias * 100).toFixed(0)}%（正=多头量占优）` })
    } else {
      dims.push({ key: 'volume-fit', label: '量能配合', value: null, basis: 'K 线/量数据不足' })
    }
  }

  return dims
}

export function radarSummary(dims: RadarDim[]): { score: number | null; direction: 'bullish' | 'bearish' | 'neutral' } {
  const values = dims.filter(d => d.value !== null).map(d => d.value as number)
  if (values.length === 0) return { score: null, direction: 'neutral' }
  const score = values.reduce((a, b) => a + b, 0) / values.length
  const direction = score >= 55 ? 'bullish' : score <= 45 ? 'bearish' : 'neutral'
  return { score: Math.round(score * 10) / 10, direction }
}

// ── 证据链拼装 ───────────────────────────────────────────────────────────

/** 买卖点类型 → 缠论定义行（hasBackchi 时附背驰联动提示）。 */
export function pointWhy(pointType: string, hasBackchi: boolean): string {
  const t = pointType.toLowerCase()
  const table: Record<string, string> = {
    '1buy': '下跌趋势 + 底背驰 → 一类买点（趋势力度衰竭的首个反转点）',
    '2buy': '一买后回调不创新低 → 二类买点（反转确认）',
    '3buy': '中枢上沿突破后回踩不回中枢 → 三类买点（中枢结束确认）',
    '1sell': '上涨趋势 + 顶背驰 → 一类卖点（趋势力度衰竭的首个反转点）',
    '2sell': '一卖后反抽不创新高 → 二类卖点（反转确认）',
    '3sell': '中枢下沿跌破后反抽不回中枢 → 三类卖点（中枢结束确认）',
  }
  const base = table[t.split('.')[0] ?? t] ?? table[pointType] ?? '缠论结构条件触发'
  return hasBackchi ? `${base} · 动力确认见背驰卡` : base
}

const countCn = (n: number): string => (n <= 0 ? '无' : n === 1 ? '单' : n === 2 ? '两' : `${n}`)

/** 推导总链：走势结构 → 背驰 → 买卖点 → 操作参考（缺环节以「—」占位）。 */
export function evidenceChain(payload: Rec, chart: ChartSlice | null): string[] {
  const trend = asRec(payload.trend_analysis)
  const morph = asRec(payload.morphology)
  const advice = asRec(payload.trading_advice)
  const typeCn = asStr(trend.type_cn)
  const zsCount = asNum(morph.zhongshus_count) ?? 0
  const segs: string[] = []

  segs.push(typeCn !== '' ? `${typeCn}${countCn(zsCount)}中枢` : '走势未判定')

  const backchis = chart?.backchis ?? []
  const valid = backchis.filter(bc => bc.valid)
  if (valid.length > 0) {
    const kind = backchiKind(valid[valid.length - 1]!.backchiType)
    segs.push(`末段${kind === 'top' ? '顶' : kind === 'bottom' ? '底' : '盘整'}背驰成立`)
  } else {
    segs.push(backchis.length > 0 ? '背驰未确认' : '暂无背驰')
  }

  const dynamics = asRec(payload.dynamics)
  const buys = asArr(dynamics.buy_points).map(asRec)
  const sells = asArr(dynamics.sell_points).map(asRec)
  const latest = [...buys, ...sells][0] ?? asArr(payload.latest_signals).map(asRec)[0] ?? null
  if (latest !== null) {
    const higher = latest.confirmed_by_higher === true
    segs.push(`${asStr(latest.type) || '信号'}${higher ? '·高级别✓' : '·待高级别确认'}`)
  } else {
    segs.push('无买卖点')
  }

  const action = asStr(advice.recommended_action)
  segs.push(action !== '' ? `参考：${action}` : '—')
  return segs
}
