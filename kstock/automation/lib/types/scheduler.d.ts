/** Pure tick planning for the dispatch clock. Each active automation's cursor
 * (the most recent occurrence it considered) plus the grace window produce one
 * decision per tick; the service turns the decision into durable transitions.
 *
 * Dispatch policy (at-most-once): only the LATEST due occurrence can catch up
 * after downtime, and only within the misfire-grace window. Older work is
 * cursor-advanced without records — it is never replayed as a write backlog.
 */
export declare const EPOCH_MS = 0;
export type TickDecision = {
    readonly kind: 'idle';
}
/** The latest due occurrence is inside the grace window: run it. */
 | {
    readonly kind: 'dispatch';
    readonly occurrenceMs: number;
    readonly olderMs: readonly number[];
}
/** The latest due occurrence is stale: record skipped(misfire). */
 | {
    readonly kind: 'misfire';
    readonly occurrenceMs: number;
    readonly olderMs: readonly number[];
};
/**
 * Plan one tick for one schedule.
 * @param scheduleMsAccessor - recurrence lookup (kept injectable for tests).
 */
export declare function planTick(options: {
    readonly nextAfter: (afterMs: number) => number | undefined;
    readonly cursorMs: number;
    readonly nowMs: number;
    readonly graceMs: number;
}): TickDecision;
