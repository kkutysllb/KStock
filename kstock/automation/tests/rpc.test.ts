/** RPC adapter tests: endpoint routing, payload validation, envelope mapping. */
import test from 'node:test'
import assert from 'node:assert/strict'

import { handleAutomationRpc, RPC_CHANNEL } from '../src/rpc.ts'

/** Minimal service fake covering the endpoints under test. */
function fakeService() {
  const automations = [{
    id: 'kauto-1',
    revision: 2,
    name: '巡检',
    prompt: 'p',
    status: 'active',
    schedule: { kind: 'daily', time: '09:30' },
    scheduleSummary: '每天 09:30 (Asia/Shanghai)',
    timeZone: 'Asia/Shanghai',
    permission: 'read-only',
    workspaceId: 'ws-1',
    cwd: '/repo/a',
    agentPreset: 'standard',
    model: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }]
  return {
    snapshot: async ({ lang }: { lang: 'zh' | 'en' }) => ({
      workspace: { id: 'ws-1', title: 'a', cwd: '/repo/a', registered: true },
      automations,
      runs: [],
      policy: { runTimeoutMinutes: 60, misfireGraceMinutes: 15, historyLimit: 200 },
      serverNow: '2026-01-01T00:00:00.000Z',
      lang,
    }),
    registerWorkspace: async (path: string) => ({ id: 'ws-new', title: 'new', path }),
    deleteRun: async (automationId: string, runId: string) => undefined,
    clearRuns: async (automationId: string) => 3,

    create: async (input: unknown) => {
      await validateShape(input)
      return { id: 'kauto-2', revision: 1 }
    },
    update: async (id: string, input: unknown) => {
      assert.equal(id, 'kauto-1')
      return { id, ...(input as object) as object, revision: 3 }
    },
    mutate: async (id: string, mutation: string) => {
      if (id === 'missing') throw Object.assign(new Error('未找到'), { code: 'not-found', name: 'ServiceError' })
      return { id, mutation }
    },
    runNow: async (id: string) => ({ id: 'krun-9', scheduledFor: '2026-01-01T00:00:00.000Z', automationId: id }),
    listRuns: (_id: string, limit: number) => ({ runs: [], limit }),
    revisionOf: (id: string) => (id === 'kauto-1' ? 2 : -1),
  } as never
}

async function validateShape(input: unknown): Promise<void> {
  const record = input as Record<string, unknown>
  if (typeof record.name !== 'string' || record.name === '') throw new Error('name must be a non-empty string')
}

const signal = new AbortController().signal

test('channel constant matches the client contract', () => {
  assert.equal(RPC_CHANNEL, '/dsh-kylin-automation')
})

test('snapshot returns the envelope with value', async () => {
  const result = await handleAutomationRpc(fakeService(), 'snapshot', { sessionId: 's1', lang: 'en' }, signal)
  assert.equal(result.ok, true)
  if (result.ok) {
    const value = result.value as { workspace?: { cwd: string }; automations?: unknown[] }
    assert.equal(value.workspace?.cwd, '/repo/a')
    assert.equal(value.automations?.length, 1)
  }
})

test('snapshot without a live session relays the standalone snapshot (no unavailable flag)', async () => {
  const service = {
    snapshot: async () => ({
      workspaces: [{ id: 'ws-1', title: '研究', cwd: '/repo/a' }],
      automations: [],
      runs: [],
    }),
  } as never
  const result = await handleAutomationRpc(service, 'snapshot', {}, signal)
  assert.equal(result.ok, true)
  if (result.ok) {
    const value = result.value as { unavailable?: string; workspaces?: unknown[]; automations?: unknown[] }
    assert.equal(value.unavailable, undefined)
    assert.equal(value.workspaces?.length, 1)
    assert.equal(value.automations?.length, 0)
  }
})

test('register-workspace relays the registered workspace', async () => {
  const result = await handleAutomationRpc(fakeService(), 'register-workspace', { path: '/repo/new' }, signal)
  assert.equal(result.ok, true)
  if (result.ok) {
    const value = result.value as { id: string; path: string }
    assert.equal(value.id, 'ws-new')
    assert.equal(value.path, '/repo/new')
  }
})

test('register-workspace requires a path', async () => {
  const result = await handleAutomationRpc(fakeService(), 'register-workspace', {}, signal)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'invalid')
})


test('delete-run relays ids to the service', async () => {
  const result = await handleAutomationRpc(fakeService(), 'delete-run', { automationId: 'kauto-1', runId: 'krun-1' }, signal)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal((result.value as { id: string }).id, 'krun-1')
})

test('clear-runs returns the cleared count', async () => {
  const result = await handleAutomationRpc(fakeService(), 'clear-runs', { automationId: 'kauto-1' }, signal)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal((result.value as { cleared: number }).cleared, 3)
})

test('non-object payloads fail with an invalid envelope', async () => {
  const result = await handleAutomationRpc(fakeService(), 'snapshot', 'nope', signal)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'invalid')
})

test('mutate rejects unknown mutations', async () => {
  const result = await handleAutomationRpc(fakeService(), 'mutate', { automationId: 'kauto-1', mutation: 'explode' }, signal)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'invalid')
})

test('unknown endpoint fails with not-found', async () => {
  const result = await handleAutomationRpc(fakeService(), 'nope', {}, signal)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'not-found')
})

test('revision conflicts fail closed', async () => {
  const result = await handleAutomationRpc(
    fakeService(),
    'update',
    { automationId: 'kauto-1', expectedRevision: 1, input: { name: '新名字' } },
    signal,
  )
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'revision-conflict')
})

test('runs endpoint rejects an out-of-range limit and passes a valid one', async () => {
  let seen: unknown
  const service = {
    listRuns: (id: string, limit: number) => {
      seen = limit
      return []
    },
  } as never
  const tooBig = await handleAutomationRpc(service, 'runs', { automationId: 'kauto-1', limit: 500 }, signal)
  assert.equal(tooBig.ok, false)
  if (!tooBig.ok) assert.equal(tooBig.error.code, 'invalid')
  const ok = await handleAutomationRpc(service, 'runs', { automationId: 'kauto-1', limit: 50 }, signal)
  assert.equal(ok.ok, true)
  assert.equal(seen, 50)
})

test('aborted signals short-circuit', async () => {
  const controller = new AbortController()
  controller.abort()
  const result = await handleAutomationRpc(fakeService(), 'snapshot', {}, controller.signal)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.code, 'aborted')
})
