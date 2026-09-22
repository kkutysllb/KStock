/** Pure tick planning for the dispatch clock. Each active automation's cursor
 * (the most recent occurrence it considered) plus the grace window produce one
 * decision per tick; the service turns the decision into durable transitions.
 *
 * Dispatch policy (at-most-once): only the LATEST due occurrence can catch up
 * after downtime, and only within the misfire-grace window. Older work is
 * cursor-advanced without records — it is never replayed as a write backlog.
 */

export const EPOCH_MS = 0

export type TickDecision =
  | { readonly kind: 'idle' }
  /** The latest due occurrence is inside the grace window: run it. */
  | { readonly kind: 'dispatch'; readonly occurrenceMs: number; readonly olderMs: readonly number[] }
  /** The latest due occurrence is stale: record skipped(misfire). */
  | { readonly kind: 'misfire'; readonly occurrenceMs: number; readonly olderMs: readonly number[] }

/**
 * Plan one tick for one schedule.
 * @param scheduleMsAccessor - recurrence lookup (kept injectable for tests).
 */
export function planTick(options: {
  readonly nextAfter: (afterMs: number) => number | undefined
  readonly cursorMs: number
  readonly nowMs: number
  readonly graceMs: number
}): TickDecision {
  const { nextAfter, cursorMs, nowMs, graceMs } = options
  const due: number[] = []
  let cursor = cursorMs
  let latest: number | undefined
  for (let guard = 0; guard < 8; guard += 1) {
    const next = nextAfter(cursor)
    if (next === undefined || next > nowMs) break
    due.push(next)
    cursor = next
    latest = next
  }
  if (latest === undefined || due.length === 0) return { kind: 'idle' }
  const older = due.slice(0, -1)
  if (nowMs - latest <= graceMs) {
    return { kind: 'dispatch', occurrenceMs: latest, olderMs: older }
  }
  return { kind: 'misfire', occurrenceMs: latest, olderMs: older }
}
