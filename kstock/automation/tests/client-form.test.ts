/** Client-side pure helpers: schedule form conversion and presentation. */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  emptyForm,
  formToModelTarget,
  formToSchedule,
  formatDuration,
  localInputValue,
  sortRunsDesc,
  statusClass,
  statusLabel,
} from '../src/client/form.ts'
import type { RunView } from '../src/client/protocol.ts'
import { unwrapRpcResult } from '../src/client/protocol.ts'

function form(overrides: Partial<ReturnType<typeof emptyForm>> = {}): ReturnType<typeof emptyForm> {
  return {
    ...emptyForm('2026-03-05T02:00:00.000Z', 'ws-1'),
    ...overrides,
  }
}

test('daily/weekly forms require HH:mm and a zone', () => {
  assert.deepEqual(formToSchedule({ ...form(), scheduleKind: 'daily' }, 'zh'), {
    schedule: { kind: 'daily', time: '09:30' },
    timeZone: form().timeZone,
  })
  assert.equal(typeof formToSchedule({ ...form(), scheduleKind: 'daily', wallTime: '9:60' }, 'zh'), 'string')
  const weekly = formToSchedule({ ...form(), scheduleKind: 'weekly', weekdays: [6, 1] }, 'en')
  assert.deepEqual((weekly as { schedule: { weekdays?: number[] } }).schedule.weekdays, [1, 6])
})

test('interval validates the ≥5 integer rule', () => {
  assert.equal(typeof formToSchedule({ ...form(), scheduleKind: 'interval', everyMinutes: '3' }, 'zh'), 'string')
  const ok = formToSchedule({ ...form(), scheduleKind: 'interval', everyMinutes: '15' }, 'zh')
  assert.deepEqual(ok, { schedule: { kind: 'interval', everyMinutes: 15 }, timeZone: '' })
})

test('once form converts to an ISO instant', () => {
  const result = formToSchedule({ ...form(), scheduleKind: 'once' }, 'zh')
  if (typeof result === 'string') throw new Error(result)
  assert.match(result.schedule.at ?? '', /^\d{4}-/)
})

test('model target: follow global vs pinned triple', () => {
  assert.equal(formToModelTarget(form()), null)
  assert.equal(formToModelTarget({ ...form(), followModel: false }), null)
  assert.deepEqual(
    formToModelTarget({ ...form(), followModel: false, provider: 'p', model: 'm', effort: 'e' }),
    { provider: 'p', model: 'm', reasoningEffort: 'e' },
  )
  assert.deepEqual(
    formToModelTarget({ ...form(), followModel: false, provider: 'p', model: 'm', effort: '' }),
    { provider: 'p', model: 'm', reasoningEffort: null },
  )
})

test('presentation helpers', () => {
  assert.equal(localInputValue(new Date(2026, 2, 5, 9, 30)), '2026-03-05T09:30')
  assert.equal(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:00:30Z', 'zh'), '30 秒')
  assert.equal(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:05:00Z', 'en'), '5m 0s')
  assert.equal(statusClass('succeeded'), 'kyl-status kyl-status-succeeded')
  assert.equal(statusLabel('running', key => `L:${key}`), 'L:statusRunning')
  const stubRun = (id: string, scheduledFor: string, finishedAt: string): RunView => ({
    id, automationId: 'a', automationName: 'n', revision: 1, trigger: 'schedule',
    status: 'succeeded', scheduledFor, finishedAt,
  })
  assert.deepEqual(sortRunsDesc([
    stubRun('r1', '2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z'),
    stubRun('r2', '2026-01-01T00:00:00Z', '2026-01-01T02:00:00Z'),
    stubRun('r3', '2026-01-02T00:00:00Z', '2026-01-02T00:01:00Z'),
  ]).map(run => run.finishedAt), ['2026-01-02T00:01:00Z', '2026-01-01T02:00:00Z', '2026-01-01T01:00:00Z'])
})

test('empty form pre-fills a future instant and local zone', () => {
  const fresh = emptyForm('2026-03-05T02:00:00.000Z')
  assert.match(fresh.onceAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  assert.ok(fresh.timeZone.includes('/'))
  assert.equal(fresh.permission, 'read-only')
  assert.equal(fresh.followModel, true)
})

test('rpc envelope unwrapping fails closed', () => {
  assert.equal(unwrapRpcResult<number>({ ok: true, value: 5 }), 5)
  assert.throws(() => unwrapRpcResult<number>({ ok: false, error: { code: 'x', message: 'bad' } }), /bad/)
  assert.throws(() => unwrapRpcResult<number>(null))
  assert.throws(() => unwrapRpcResult<number>({ ok: 1 }))
})
