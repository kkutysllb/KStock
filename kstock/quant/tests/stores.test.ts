/**
 * @kstock/quant 存储层测试（node:test，tsx 加载）。
 *
 * 覆盖四库的 1.x 兼容语义：版本链乐观并发、运行附件、口径对比、
 * 报告库 sha256 寻址与删除标记。数据落在临时目录，互不污染。
 *
 * 运行：node --import tsx/esm --test kstock/quant/tests/*.test.ts
 */

import { strict as assert } from 'node:assert'
import { test, before, after } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { StoreError, strategyStore } from '../src/store.ts'
import { ReportsStore } from '../src/reports.ts'

let root: string
let strategies: ReturnType<typeof strategyStore>
let reports: ReportsStore

before(() => {
  root = mkdtempSync(join(tmpdir(), 'kstock-quant-test-'))
  strategies = strategyStore(root)
  reports = new ReportsStore(root)
})

after(() => {
  rmSync(root, { recursive: true, force: true })
})

test('策略库：创建 → 版本链乐观并发 → 运行记录与附件', () => {
  const created = strategies.create('kstock-local', '双均线', { hypothesis: '金叉买死叉卖' })
  const id = String(created.strategy_id)
  assert.equal(created.current_version, 0)

  strategies.saveVersion('kstock-local', id, { code: 'def signal():\n    return 1\n', change_note: '初版', params: { fast: 5 } })
  const v2 = strategies.saveVersion('kstock-local', id, {
    code: 'def signal():\n    return 2\n',
    change_note: '调参',
    params: { fast: 10 },
    parent_version: 1,
  })
  assert.equal(v2.version, 2)

  // 基于过期版本提交 → 409
  assert.throws(
    () => strategies.saveVersion('kstock-local', id, { code: 'x', parent_version: 1 }),
    (error: unknown) => error instanceof StoreError && error.status === 409,
  )

  strategies.recordRun('kstock-local', id, {
    version: 2,
    data_start: '2025-01-01',
    data_end: '2025-12-31',
    rules: { slippage: 0.001 },
    metrics: { total_return_pct: 12.5, sharpe_ratio: 1.1 },
    equity: [[0, 1], [1, 1.125]],
  })
  const runs = strategies.listRuns('kstock-local', id)
  assert.equal(runs.length, 1)
  const runId = String(runs[0]!.run_id)
  assert.deepEqual(runs[0]!.rules, { slippage: 0.001 })

  const equity = strategies.getRunAttachment('kstock-local', id, runId, 'equity')
  assert.equal(equity.data_start, '2025-01-01')
  assert.equal((equity.equity as number[][])[1]![1], 1.125)

  // 版本越界拒绝
  assert.throws(
    () => strategies.recordRun('kstock-local', id, { version: 9, metrics: {} }),
    (error: unknown) => error instanceof StoreError && error.status === 422,
  )

  const list = strategies.list('kstock-local')
  assert.equal(list.length, 1)
  assert.equal((list[0]!.latest_run as Record<string, unknown>).run_id, runs[0]!.run_id)
})

test('报告库：归档 → 覆盖更新保留 created_at → 删除标记', () => {
  const html = '<html><body>KStock 报告样例</body></html>'
  const first = reports.archive('kstock-local', {
    threadId: 'thread-t1',
    reportId: 'report-test01',
    title: '样例报告',
    symbol: '600519',
    content: html,
    generatedAt: '2026-09-18T09:00:00+08:00',
  })
  assert.equal(first.size_bytes, Buffer.byteLength(html))
  assert.match(String(first.relative_path), /reports\/kstock-local\/2026\/09\/18\/report-test01\.html$/)

  const second = reports.archive('kstock-local', {
    threadId: 'thread-t1',
    reportId: 'report-test01',
    title: '样例报告 v2',
    content: html + '<!-- v2 -->',
    generatedAt: '2026-09-18T10:00:00+08:00',
  })
  assert.equal(second.created_at, first.created_at, '覆盖更新保留 created_at')
  assert.notEqual(second.sha256, first.sha256)
  assert.equal(second.size_bytes, Buffer.byteLength(html) + '<!-- v2 -->'.length)

  // 内容读取与路径越界防护
  const content = reports.readContent('kstock-local', 'report-test01')
  assert.ok(content.toString('utf-8').endsWith('<!-- v2 -->'))

  // 列表过滤（中文 LIKE）
  const hit = reports.list('kstock-local', { query: '样例' })
  assert.equal(hit.length, 1)

  reports.delete('kstock-local', 'report-test01')
  assert.equal(reports.find('kstock-local', 'report-test01'), null)
  assert.throws(
    () => reports.readContent('kstock-local', 'report-test01'),
    (error: unknown) => error instanceof StoreError && error.status === 404,
  )
  // 再删一次 → 404（与 1.x 路由行为一致）
  assert.throws(
    () => reports.delete('kstock-local', 'report-test01'),
    (error: unknown) => error instanceof StoreError && error.status === 404,
  )

  // 删除标记已记录（同内容再次归档不被拦截——显式入库优先，语义与 1.x 一致）
  const resurrect = reports.archive('kstock-local', {
    threadId: 'thread-t1', reportId: 'report-test02', title: '复活样例', content: html + '<!-- v2 -->',
  })
  assert.match(String(resurrect.report_id), /^report-test02$/)
  reports.delete('kstock-local', 'report-test02')
})

test('路径组件白名单：恶意 id 拒绝', () => {
  assert.throws(
    () => reports.find('kstock-local', '../evil'),
    (error: unknown) => error instanceof StoreError && error.status === 422,
  )
})
