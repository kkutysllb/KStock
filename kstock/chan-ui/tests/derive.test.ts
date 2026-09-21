import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  backchiPriceRelation, dateIndexOf, evidenceChain, LEVEL_OPTIONS, matrixLevels, parseChart,
  pointWhy, radarDims, radarSummary, resolveIndex, zhongshuForecast, zhongshuPosition,
} from '../src/client/derive.ts'

test('matrixLevels: 中间级别取低一档+当前+高两档', () => {
  assert.deepEqual(matrixLevels('daily'), ['120min', 'daily', 'weekly', 'monthly'])
  assert.deepEqual(matrixLevels('30min'), ['15min', '30min', '60min', '90min'])
})

test('matrixLevels: 边界向另一侧顺延补足四行', () => {
  assert.deepEqual(matrixLevels('5min'), ['5min', '15min', '30min', '60min'])
  // 顶部窗口为连续四档：monthly→120min/daily/weekly/monthly（plan 原文期望 '60min' 系笔误，已见 commit 8738cfd2 勘误）。
  assert.deepEqual(matrixLevels('monthly'), ['120min', 'daily', 'weekly', 'monthly'])
})

test('matrixLevels: 未知级别回退 daily 窗口', () => {
  assert.deepEqual(matrixLevels('nonsense'), matrixLevels('daily'))
})

test('matrixLevels: 任意级别窗口恒为连续四档且含自身', () => {
  for (const level of LEVEL_OPTIONS) {
    const w = matrixLevels(level)
    assert.equal(w.length, 4)
    assert.ok(w.includes(level))
    for (let i = 1; i < w.length; i += 1) {
      assert.equal(LEVEL_OPTIONS.indexOf(w[i]!), LEVEL_OPTIONS.indexOf(w[i - 1]!) + 1)
    }
  }
})

test('resolveIndex: 全时间戳精确优先，前缀兜底', () => {
  const map = dateIndexOf(['2026-01-05 09:30', '2026-01-05 10:00', '2026-01-06 09:30'])
  assert.equal(resolveIndex(map, '2026-01-05 09:30'), 0)   // 精确命中，而非当日末根
  assert.equal(resolveIndex(map, '2026-01-05'), 1)         // 前缀兜底=当日末根（旧语义保留）
  assert.equal(resolveIndex(map, '2026-02-01'), -1)
})

test('parseChart: markers 缺失 time 时回落历史 date 字段', () => {
  const c = parseChart({ chart_data: { dates: ['2026-01-05', '2026-01-06'], kline: [[1, 2, 0.5, 2.5], [2, 3, 1.5, 3.5]], markers: [{ date: '2026-01-06', price: 3 }] } })
  assert.equal(c!.markers[0]!.time, '2026-01-06')
})

const chart: ReturnType<typeof parseChart> = parseChart({
  chart_data: {
    dates: ['2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09'],
    kline: [[10, 11, 9.5, 11.2], [11, 10.5, 10.2, 11.4], [10.5, 11.8, 10.4, 11.9], [11.8, 11.2, 11.0, 11.95], [11.2, 10.9, 10.8, 11.3], [10.9, 11.5, 10.7, 11.6]],
    volumes: [100, 120, 90, 80, 70, 110],
    bi_lines: [], seg_lines: [], zhongshu_zones: [], markers: [], fenxings: [],
    backchis: [{ backchi_type: 'bottom', valid: true, previous_start: '2026-01-02', previous_end: '2026-01-05', current_start: '2026-01-06', current_end: '2026-01-07' }],
    macd: { dif: [], dea: [], hist: [] },
  },
})
const di = dateIndexOf(chart!.dates)

test('backchiPriceRelation: 顶背驰价格新高判定', () => {
  const rel = backchiPriceRelation(chart!, di, {
    backchiType: 'top', valid: true,
    currentStart: '2026-01-06', currentEnd: '2026-01-07',
    previousStart: '2026-01-02', previousEnd: '2026-01-05',
    currentMacdArea: 0.1, previousMacdArea: 0.2, macdDivergence: -0.1,
  })
  assert.equal(rel!.kind, 'top')
  assert.equal(rel!.prevHigh, 11.4)
  assert.equal(rel!.curHigh, 11.95)
  assert.equal(rel!.newExtreme, true)
})

test('zhongshuPosition/Forecast: 五档位置与推演文案', () => {
  const zs = { start_time: '2026-01-02', end_time: '2026-01-08', high: 11, low: 10, center: 10.5, gg: 11.4, dd: 9.6 }
  assert.equal(zhongshuPosition(11.5, zs), 'above')
  assert.equal(zhongshuPosition(10.5, zs), 'inside')
  assert.equal(zhongshuPosition(9.5, zs), 'below')
  assert.match(zhongshuForecast(11.5, zs), /三买/)
  assert.match(zhongshuForecast(9.5, zs), /跌破/)
  assert.match(zhongshuForecast(10.5, zs), /震荡/)
})

test('radarDims: 七维齐全 + 缺维为 null 退出总分', () => {
  const payload = {
    morphology: { klines_count: 100, processed_klines_count: 90, fenxings_count: 40, bis_count: 20, segs_count: 5, zhongshus_count: 1 },
    trend_analysis: { trend_strength: 0.66 },
    chart_data: { zhongshu_zones: [{ high: 11, low: 10, center: 10.5, stability: 0.8 }], backchis: [{ backchi_type: 'top', valid: true, macd_divergence: -0.1 }],
      volumes: [10, 20, 30, 25, 15, 22], kline: [[1, 2, 0.5, 2.5], [2, 3, 1.5, 3.5], [3, 2.6, 2.4, 3.2], [2.6, 3.1, 2.5, 3.3], [3.1, 2.9, 2.7, 3.2], [2.9, 3.4, 2.8, 3.6]] },
    latest_signals: [{ type: '1buy', price: 10, timestamp: 't', reliability: 0.7 }],
  }
  const dims = radarDims(payload, [
    { status: 'ok', data: { trend_analysis: { type_cn: '上涨' } } },
    { status: 'ok', data: { trend_analysis: { type_cn: '上涨' } } },
    { status: 'error' },
  ])
  assert.equal(dims.length, 7)
  assert.equal(dims.filter(d => d.value !== null).length, 7)
  const summary = radarSummary(dims)
  assert.ok(summary.score !== null && summary.score > 0 && summary.score <= 100)
  // 无中枢 → 稳定度维为 null 且退出总分
  const noZs = radarDims({ morphology: payload.morphology, trend_analysis: { trend_strength: 0.5 }, chart_data: {} }, [])
  const stab = noZs.find(d => d.key === 'zs-stability')!
  assert.equal(stab.value, null)
})

test('radarDims: 级别共振 <2 ok 行为 null', () => {
  const dims = radarDims({ chart_data: {} }, [{ status: 'ok', data: { trend_analysis: { type_cn: '上涨' } } }])
  assert.equal(dims.find(d => d.key === 'level-resonance')!.value, null)
})

test('pointWhy/evidenceChain: 定义行与推理链拼装', () => {
  // 实现文案为「一类买点」（缠论原生术语），不含子串「一买」；plan 已勘误，见 commit 27d134e2。
  assert.match(pointWhy('1buy', true), /一类买点/)
  assert.match(pointWhy('1buy', true), /背驰/)
  const segs = evidenceChain({
    trend_analysis: { type_cn: '下跌', trend_strength: 0.4 },
    morphology: { zhongshus_count: 2 },
    chart_data: { backchis: [{ backchi_type: 'bottom', valid: true }] },
    dynamics: { buy_points: [{ type: '1buy', price: 10, timestamp: 't', reliability: 0.7, strength: 0.5, confirmed_by_higher: false }] },
    trading_advice: { recommended_action: '观望' },
  }, chart)
  assert.ok(segs.length >= 3)
  assert.match(segs.join('→'), /下跌两中枢/)
  assert.match(segs.join('→'), /底背驰/)
})

test('radarSummary: 空维度集返回 null 分', () => {
  assert.equal(radarSummary([]).score, null)
})

test('radarSummary: 三档方向阈值（≥55 看多 / ≤45 看空 / 区间中性）', () => {
  const dim = (v: number) => ({ key: 'k', label: 'k', value: v, basis: '' })
  assert.equal(radarSummary([dim(60), dim(52)]).direction, 'bullish')
  assert.equal(radarSummary([dim(40), dim(48)]).direction, 'bearish')
  assert.equal(radarSummary([dim(50), dim(50)]).direction, 'neutral')
  // null 维退出平均：60 与 null → 只平均 60
  const withNull = radarSummary([{ key: 'k', label: 'k', value: 60, basis: '' }, { key: 'n', label: 'n', value: null, basis: '' }])
  assert.equal(withNull.score, 60)
})

test('evidenceChain: 买卖点并存时按 timestamp 取最新', () => {
  const segs = evidenceChain({
    trend_analysis: { type_cn: '震荡' },
    chart_data: {},
    dynamics: {
      buy_points: [{ type: '2buy', price: 10, timestamp: '2026-01-02 10:00', reliability: 0.6, strength: 0.5, confirmed_by_higher: false }],
      sell_points: [{ type: '1sell', price: 11, timestamp: '2026-01-08 14:30', reliability: 0.8, strength: 0.5, confirmed_by_higher: true }],
    },
  }, chart)
  assert.match(segs.join('→'), /1sell·高级别✓/)
})
