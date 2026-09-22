/** Client runtime notice channel: push → snapshot + listeners, dismiss resets.
 * The notice line is how bridge failures (openSession / pickDirectory) become
 * visible panel messages instead of silent no-ops. */
import test from 'node:test'
import assert from 'node:assert/strict'

import { createAutomationsRuntime, type AutomationsRuntimeDeps } from '../src/client/runtime.ts'

function deps(): AutomationsRuntimeDeps {
  return {
    rpc: { call: async () => ({ ok: true, value: undefined }) },
    sessionId: () => undefined,
    lang: () => 'zh',
  }
}

test('pushNotice publishes the latest text to subscribers; dismiss clears', () => {
  const runtime = createAutomationsRuntime(deps())
  const seen: (string | undefined)[] = []
  const stop = runtime.notice.subscribe(() => { seen.push(runtime.notice.getSnapshot()) })

  assert.equal(runtime.notice.getSnapshot(), undefined)

  runtime.pushNotice('无法打开会话：当前环境未提供会话导航服务')
  assert.equal(runtime.notice.getSnapshot(), '无法打开会话：当前环境未提供会话导航服务')
  runtime.pushNotice('第二条')
  assert.equal(runtime.notice.getSnapshot(), '第二条', 'latest notice wins')

  runtime.dismissNotice()
  assert.equal(runtime.notice.getSnapshot(), undefined)
  assert.deepEqual(seen, [
    '无法打开会话：当前环境未提供会话导航服务',
    '第二条',
    undefined,
  ])
  stop()
})

test('notice unsubscribe stops deliveries without affecting the store', () => {
  const runtime = createAutomationsRuntime(deps())
  let count = 0
  const stop = runtime.notice.subscribe(() => { count += 1 })
  runtime.pushNotice('a')
  stop()
  runtime.pushNotice('b')
  assert.equal(count, 1, 'no delivery after unsubscribe')
  assert.equal(runtime.notice.getSnapshot(), 'b')
  runtime.dismissNotice()
  assert.equal(runtime.notice.getSnapshot(), undefined)
})

test('dismiss on an empty notice is a no-op that still notifies consistently', () => {
  const runtime = createAutomationsRuntime(deps())
  let count = 0
  const stop = runtime.notice.subscribe(() => { count += 1 })
  runtime.dismissNotice()
  assert.equal(count, 1)
  assert.equal(runtime.notice.getSnapshot(), undefined)
  stop()
})
