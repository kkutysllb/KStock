/** Agent tool tests: binding, ownership, envelopes, and approval policy. */
import test from 'node:test'
import assert from 'node:assert/strict'

import { automationToolDefs, callerFrom, definitionSummary, MUTATING_TOOLS, runSummary } from '../src/tools.ts'
import { needsHumanApproval } from '../src/index.ts'

function fakeService(overrides: Record<string, unknown> = {}) {
  const definitions = new Map<string, unknown>([
    ['kauto-1', {
      id: 'kauto-1',
      revision: 1,
      name: '巡检',
      status: 'active',
      schedule: { kind: 'daily', time: '09:30' },
      timeZone: 'Asia/Shanghai',
      target: { permission: 'read-only', modelTarget: null, cwd: '/repo/a' },
    }],
  ])
  return {
    resolveWorkspace: async (cwd: string) => ({ id: 'ws-1', title: 'a', path: cwd }),
    agentPresetForSession: () => 'standard',
    automationsForCwd: (cwd: string) => (cwd === '/repo/a' ? [{ id: 'kauto-1', name: '巡检', prompt: 'p', revision: 2, status: 'active', schedule: { kind: 'daily', time: '09:30' }, scheduleSummary: '每天', timeZone: 'Asia/Shanghai', permission: 'read-only', workspaceId: 'ws-1', cwd, agentPreset: 'standard', model: null, createdAt: '', updatedAt: '' }] : []),
    definitionOf: (id: string) => definitions.get(id),
    create: async () => ({ id: 'kauto-2', revision: 1, name: 'n', status: 'active', schedule: { kind: 'interval', everyMinutes: 30 }, timeZone: '', target: { permission: 'read-only', modelTarget: null } }),
    update: async () => ({ id: 'kauto-1', revision: 3, name: 'n2', status: 'active', schedule: { kind: 'daily', time: '10:00' }, timeZone: 'Asia/Shanghai', target: { permission: 'read-only', modelTarget: null } }),
    runNow: async (id: string) => ({ id: 'krun-1', status: 'queued', scheduledFor: 'now', automationId: id }),
    mutate: async () => ({}),
    listRuns: () => [{
      id: 'krun-1', automationName: '巡检', status: 'succeeded', trigger: 'schedule',
      scheduledFor: '2026-01-01T00:00:00Z', sessionId: 'kauto-session-x',
      summary: 'done',
    }],
    ...overrides,
  } as never
}

function execFor(cwd: string | undefined, sessionId = 'session-1'): unknown {
  return { agent: { session: { id: sessionId, header: { cwd } } } }
}

const signalOk = { signal: new AbortController().signal }

test('mutating tools require human approval; reads and pause-only updates do not', () => {
  const exec = { name: 'automation_create', arguments: {}, signal: signalOk.signal }
  assert.equal(needsHumanApproval(exec, true), true)
  assert.equal(needsHumanApproval(exec, false), false)
  const pauseOnly = { name: 'automation_update', arguments: { id: 'a', status: 'paused' }, signal: signalOk.signal }
  assert.equal(needsHumanApproval(pauseOnly, true), false)
  const pauseAndPrompt = { name: 'automation_update', arguments: { id: 'a', status: 'paused', name: 'x' }, signal: signalOk.signal }
  assert.equal(needsHumanApproval(pauseAndPrompt, true), true)
})

test('all six tools are present with schemas and outputs', () => {
  const defs = automationToolDefs(fakeService())
  assert.deepEqual(defs.map(def => def.name), [
    'automation_create', 'automation_list', 'automation_update',
    'automation_run_now', 'automation_runs', 'automation_delete',
  ])
  for (const def of defs) {
    assert.equal(typeof def.description, 'string')
    assert.ok(def.parameters.type === 'object')
    assert.equal(def.output.schema.type, 'object')
    assert.equal(typeof def.execute, 'function')
    assert.equal(typeof def.output.render, 'function')
  }
})

test('caller binding extracts the session cwd', () => {
  assert.deepEqual(callerFrom(execFor('/repo/a')), { cwd: '/repo/a', sessionId: 'session-1' })
  assert.deepEqual(callerFrom({}), { cwd: undefined, sessionId: undefined })
})

test('tools without a caller cwd fail with no-session', async () => {
  const defs = automationToolDefs(fakeService())
  const list = defs.find(def => def.name === 'automation_list')!
  const result = await list.execute({}, execFor(undefined)) as { ok: boolean; error?: { code: string } }
  assert.equal(result.ok, false)
  assert.equal(result.error?.code, 'no-session')
})

test('tools reject definitions owned by another workspace', async () => {
  const defs = automationToolDefs(fakeService())
  const runNow = defs.find(def => def.name === 'automation_run_now')!
  const result = await runNow.execute({ id: 'kauto-1' }, execFor('/repo/b')) as { ok: boolean; error?: { code: string } }
  assert.equal(result.ok, false)
  assert.equal(result.error?.code, 'forbidden')
})

test('runs tool returns bounded summaries with envelope', async () => {
  const defs = automationToolDefs(fakeService())
  const runs = defs.find(def => def.name === 'automation_runs')!
  const result = await runs.execute({ id: 'kauto-1', limit: 5 }, execFor('/repo/a')) as {
    ok: boolean
    value?: { runs: string[] }
  }
  assert.equal(result.ok, true)
  assert.match(String(result.value?.runs[0]), /succeeded/)
})

test('list tool only surfaces the caller workspace', async () => {
  const defs = automationToolDefs(fakeService())
  const list = defs.find(def => def.name === 'automation_list')!
  const other = await list.execute({}, execFor('/repo/b')) as { ok: boolean; value?: { automations: unknown[] } }
  assert.equal(other.ok, true)
  assert.equal(other.value?.automations.length, 0)
})

test('summaries stay bounded and informative', () => {
  const line = definitionSummary({
    id: 'kauto-1', revision: 4, name: '巡检', status: 'active',
    schedule: { kind: 'daily', time: '09:30' }, timeZone: 'Asia/Shanghai',
    target: { permission: 'read-only', modelTarget: null },
  })
  assert.match(line, /id=kauto-1/)
  assert.match(line, /每天/)
  const runLine = runSummary({
    id: 'krun-1', automationName: '巡检', status: 'failed', trigger: 'manual',
    scheduledFor: '2026-01-01T00:00:00Z', error: { code: 'timeout', message: '超时' },
  })
  assert.match(runLine, /error=timeout/)
})
