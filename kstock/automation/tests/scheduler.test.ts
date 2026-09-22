/** Scheduler tick-planning tests: at-most-once dispatch, catch-up of only the
 * latest due occurrence, and the misfire boundary.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { planTick } from '../src/scheduler.ts'

const MIN = 60_000

/** Deterministic interval schedule: 10-minute cadence from t0. */
function intervalSteps(): (afterMs: number) => number | undefined {
  const anchor = 0
  return after => {
    const step = 10 * MIN
    if (after < anchor) return anchor
    const k = Math.floor((after - anchor) / step)
    return anchor + (k + 1) * step
  }
}

test('idle when nothing is due', () => {
  const decision = planTick({ nextAfter: intervalNext(), cursorMs: 0, nowMs: 5 * MIN, graceMs: MIN })
  assert.deepEqual(decision, { kind: 'idle' })
})

test('dispatch the latest due occurrence inside the grace window', () => {
  // 0→10, 10→20, 20→30 due by now=25; the latest (20) is inside 15m grace.
  const decision = planTick({ nextAfter: intervalNext(), cursorMs: 0, nowMs: 25 * MIN, graceMs: 15 * MIN })
  assert.deepEqual(decision, { kind: 'dispatch', occurrenceMs: 20 * MIN, olderMs: [10 * MIN] })
})

test('misfire when the latest due occurrence is stale', () => {
  // A 10-minute cadence keeps the latest due occurrence within 10 minutes of
  // now, so a grace shorter than the staleness forces the misfire branch.
  const decision = planTick({ nextAfter: intervalNext(), cursorMs: 0, nowMs: 14 * MIN, graceMs: 3 * MIN })
  assert.deepEqual(decision, { kind: 'misfire', occurrenceMs: 10 * MIN, olderMs: [] })
})

test('older due occurrences are reported once for cursor advancement', () => {
  const decision = planTick({ nextAfter: intervalNext(), cursorMs: 0, nowMs: 31 * MIN, graceMs: 2 * MIN })
  assert.deepEqual(decision, { kind: 'dispatch', occurrenceMs: 30 * MIN, olderMs: [10 * MIN, 20 * MIN] })
})

test('grace boundary: exactly at the grace limit still dispatches', () => {
  const decision = planTick({ nextAfter: intervalNext(), cursorMs: 10 * MIN, nowMs: 35 * MIN, graceMs: 25 * MIN })
  assert.equal(decision.kind, 'dispatch')
  if (decision.kind === 'dispatch') assert.equal(decision.occurrenceMs, 30 * MIN)
})

test('zero grace only dispatches an on-time occurrence', () => {
  const late = planTick({ nextAfter: intervalNext(), cursorMs: 0, nowMs: 11 * MIN, graceMs: 0 })
  assert.equal(late.kind, 'misfire')
  const exact = planTick({ nextAfter: intervalNext(), cursorMs: 0, nowMs: 10 * MIN, graceMs: 0 })
  assert.equal(exact.kind, 'dispatch')
})

function intervalNext(): (afterMs: number) => number | undefined {
  const step = 10 * MIN
  return (afterMs) => {
    if (afterMs < 0) return 0
    const k = Math.floor(afterMs / step)
    return (k + 1) * step
  }
}
