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
        time: asStr(r.time), price: asNum(r.price) ?? 0,
        type: asStr(r.type) || undefined, label: asStr(r.label) || undefined,
        reliability: asNum(r.reliability) ?? undefined, strength: asNum(r.strength) ?? undefined,
        confirmedByHigher: r.confirmed_by_higher === true, confirmedByLower: r.confirmed_by_lower === true,
      }
    }),
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

/** 日期(YYYY-MM-DD 前 10 位) → 全局索引表。 */
export function dateIndexOf(dates: string[]): Map<string, number> {
  const map = new Map<string, number>()
  dates.forEach((date, index) => map.set(date.slice(0, 10), index))
  return map
}
