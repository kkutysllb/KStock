/** Recurrence engine: next-occurrence computation for the four friendly
 * schedule forms. Pure functions over instants so tests can drive the clock.
 *
 * Semantics (documented in README):
 * - `once`: one ISO instant; after it passes it never fires again.
 * - `interval`: anchored cadence `anchor + k × everyMinutes` in pure duration
 *   space — wall-clock changes (DST, zone edits) never shift the cadence.
 * - `daily` / `weekly`: local wall time `HH:mm` in the definition's IANA zone;
 *   nonexistent DST wall times are skipped rather than shifted, and ambiguous
 *   wall times resolve to the earlier offset (deterministic).
 */
import type { AutomationSchedule } from './types.ts';
/** Latest delay Node timers represent without clamping (wake-at cap). */
export declare const MAX_TIMER_DELAY_MS = 2147483647;
/** Validate an IANA zone by exercising it through luxon. */
export declare function isValidTimeZone(zone: string): boolean;
/** Validate `HH:mm` wall-time text. */
export declare function isValidWallTime(time: string): boolean;
/** Parse `HH:mm` into hour/minute parts (already validated). */
export declare function parseWallTime(time: string): {
    hour: number;
    minute: number;
};
/**
 * Whether an ISO schedule kind (`once` / interval `anchor`) is a valid instant.
 */
export declare function isValidInstant(value: string): boolean;
/**
 * The earliest occurrence strictly after `afterMs`, or `undefined` when the
 * schedule has no future occurrence.
 */
export declare function nextOccurrence(schedule: AutomationSchedule, timeZone: string, afterMs: number): number | undefined;
/**
 * Enumerate due occurrences strictly greater than `afterMs` and not after
 * `untilMs`, in ascending order. Bounded to keep a long-downed host from
 * enumerating months of backlog: interval cadences step by `everyMinutes`,
 * wall schedules by days. At most `limit` values are produced.
 */
export declare function dueOccurrences(schedule: AutomationSchedule, timeZone: string, afterMs: number, untilMs: number, limit?: number): number[];
/** Human-readable weekday order for summaries (Monday first). */
export declare const WEEKDAY_ORDER: readonly number[];
/** Localized one-line schedule summary for the Web UI and tool results. */
export declare function describeSchedule(schedule: AutomationSchedule, timeZone: string, lang: 'zh' | 'en'): string;
/** Render an ISO instant in the definition's zone with a stable format. */
export declare function formatInstant(iso: string, timeZone: string): string;
