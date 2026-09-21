import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dateIndexOf, LEVEL_OPTIONS, matrixLevels, parseChart, resolveIndex } from '../src/client/derive.ts'

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
