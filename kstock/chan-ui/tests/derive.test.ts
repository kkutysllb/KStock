import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matrixLevels } from '../src/client/derive.ts'

test('matrixLevels: 中间级别取低一档+当前+高两档', () => {
  assert.deepEqual(matrixLevels('daily'), ['120min', 'daily', 'weekly', 'monthly'])
  assert.deepEqual(matrixLevels('30min'), ['15min', '30min', '60min', '90min'])
})

test('matrixLevels: 边界向另一侧顺延补足四行', () => {
  assert.deepEqual(matrixLevels('5min'), ['5min', '15min', '30min', '60min'])
  // 最高档边界 = 顶部四档连续窗口（与 5min 的底部四档对称）。
  // 注：任务原文此断言期望 '60min'，但 ['60min','daily','weekly','monthly'] 在
  // LEVEL_OPTIONS 中非连续（跳过 90min/120min），任何 slice 窗口语义均不可达，
  // 判定为笔误，修正为 '120min'（derive.ts 文档注释即连续窗口语义）。
  assert.deepEqual(matrixLevels('monthly'), ['120min', 'daily', 'weekly', 'monthly'])
})

test('matrixLevels: 未知级别回退 daily 窗口', () => {
  assert.deepEqual(matrixLevels('nonsense'), ['120min', 'daily', 'weekly', 'monthly'])
})
