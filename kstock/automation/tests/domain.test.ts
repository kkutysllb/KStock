/** Domain validation and projection tests. */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  boundSummary,
  occurrenceKey,
  resolveZone,
  toAutomationView,
  validateCreateInput,
  validateUpdateInput,
  validateSchedule,
} from '../src/domain.ts'

const goodCreate = {
  name: '回归分诊',
  prompt: '检查测试证据并给出报告',
  schedule: { kind: 'daily', time: '09:30' },
  timeZone: 'Asia/Shanghai',
  workspaceId: 'ws-1',
  cwd: '/repo/a',
  agentPreset: 'standard',
  permission: 'read-only',
  modelTarget: null,
}

test('create validation passes a good payload', () => {
  const input = validateCreateInput(goodCreate)
  assert.equal(input.cwd, '/repo/a')
  assert.deepEqual(input.schedule, { kind: 'daily', time: '09:30' })
})

test('create validation rejects empty name and short interval', () => {
  assert.throws(() => validateCreateInput({ ...goodCreate, name: '  ' }), /name/)
  assert.throws(
    () => validateCreateInput({ ...goodCreate, schedule: { kind: 'interval', everyMinutes: 2 } }),
    /everyMinutes/,
  )
})

test('schedule validation covers all kinds and rejects junk', () => {
  assert.deepEqual(
    validateSchedule({ kind: 'once', at: '2026-01-02T03:04:05Z' }),
    { kind: 'once', at: '2026-01-02T03:04:05Z' },
  )
  assert.throws(() => validateSchedule({ kind: 'once', at: 'not-a-date' }), /at/)
  assert.throws(() => validateSchedule({ kind: 'weekly', time: '09:00', weekdays: [8] }), /weekdays/)
  assert.throws(() => validateSchedule({ kind: 'nope' }), /kind/)
})

test('weekly weekdays deduplicate and sort', () => {
  const schedule = validateSchedule({ kind: 'weekly', time: '09:00', weekdays: [5, 1, 1] })
  assert.ok(schedule.kind === 'weekly')
  if (schedule.kind === 'weekly') assert.deepEqual(schedule.weekdays, [1, 5])
})

test('daily/weekly require a valid IANA zone; instant kinds accept empty', () => {
  assert.throws(() => validateCreateInput({ ...goodCreate, timeZone: 'Mars/Olympus' }), /timeZone/)
  const onceOk = validateCreateInput({
    ...goodCreate,
    schedule: { kind: 'once', at: '2026-01-02T03:04:05Z' },
    timeZone: '',
  })
  assert.equal(onceOk.timeZone, '')
})

test('resolveZone enforces the schedule/zone pairing on updates', () => {
  assert.throws(() => resolveZone('', '', { kind: 'daily', time: '08:00' }), /timeZone/)
  assert.equal(resolveZone('Asia/Shanghai', undefined, { kind: 'daily', time: '08:00' }), 'Asia/Shanghai')
  assert.equal(resolveZone('', '', { kind: 'interval', everyMinutes: 10, anchor: '2026-01-01T00:00:00Z' }), '')
})

test('update validation: omitted fields stay unchanged; null clears the pin', () => {
  const update = validateUpdateInput({ status: 'paused' })
  assert.equal(update.status, 'paused')
  assert.equal(update.name, undefined)
  const cleared = validateUpdateInput({ modelTarget: null })
  assert.equal(cleared.modelTarget, null)
  const pinned = validateUpdateInput({
    modelTarget: { provider: 'deepseek', model: 'deepseek-flash', reasoningEffort: 'high' },
  })
  assert.deepEqual(pinned.modelTarget, {
    provider: 'deepseek',
    model: 'deepseek-flash',
    reasoningEffort: 'high',
  })
})

test('occurrence keys and summary bounds', () => {
  assert.equal(occurrenceKey('a', 1_000), `a|${new Date(1_000).toISOString()}`)
  assert.equal(boundSummary('  '), undefined)
  const long = 'x'.repeat(3_000)
  assert.equal(boundSummary(long)?.length, 2_000)
})

test('toAutomationView projects definition facts', () => {
  const definition = {
    id: 'kauto-1',
    prompt: 'read-only inspection',
    status: 'active' as const,
    revision: 3,
    name: '巡检',
    schedule: { kind: 'weekly', time: '09:30', weekdays: [1, 2, 3, 4, 5] } as const,
    timeZone: 'Asia/Shanghai',
    target: {
      workspaceId: 'ws-1',
      cwd: '/repo/a',
      agentPreset: 'standard',
      permission: 'read-only' as const,
      modelTarget: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: null },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  }
  const view = toAutomationView(definition, {
    lang: 'zh',
    nextRunAt: '2026-01-05T01:30:00.000Z',
    lastRun: { id: 'krun-1', scheduledFor: '2026-01-04T01:30:00.000Z', status: 'succeeded', summary: 'ok' },
  })
  assert.equal(view.id, 'kauto-1')
  assert.equal(view.revision, 3)
  assert.match(view.scheduleSummary, /周一/)
  assert.deepEqual(view.model, {
    provider: 'deepseek-official',
    model: 'deepseek-flash',
    reasoningEffort: null,
  })
  assert.equal(view.nextRunAt, '2026-01-05T01:30:00.000Z')
  assert.equal(view.lastRunStatus, 'succeeded')
})
