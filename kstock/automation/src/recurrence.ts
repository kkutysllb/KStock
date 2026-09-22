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

import { DateTime } from 'luxon'
import type { AutomationSchedule } from './types.ts'

/** Latest delay Node timers represent without clamping (wake-at cap). */
export const MAX_TIMER_DELAY_MS = 2_147_483_647

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** Validate an IANA zone by exercising it through luxon. */
export function isValidTimeZone(zone: string): boolean {
  return DateTime.now().setZone(zone).isValid
}

/** Validate `HH:mm` wall-time text. */
export function isValidWallTime(time: string): boolean {
  return HHMM_RE.test(time)
}

/** Parse `HH:mm` into hour/minute parts (already validated). */
export function parseWallTime(time: string): { hour: number; minute: number } {
  const match = HHMM_RE.exec(time)
  if (match === null) throw new Error(`invalid wall time ${JSON.stringify(time)}`)
  return { hour: Number(match[1]), minute: Number(match[2]) }
}

/**
 * Whether an ISO schedule kind (`once` / interval `anchor`) is a valid instant.
 */
export function isValidInstant(value: string): boolean {
  if (typeof value !== 'string' || value === '') return false
  const parsed = Number.isNaN(Date.parse(value)) ? null : value
  return parsed !== null
}

/**
 * The earliest occurrence strictly after `afterMs`, or `undefined` when the
 * schedule has no future occurrence.
 */
export function nextOccurrence(
  schedule: AutomationSchedule,
  timeZone: string,
  afterMs: number,
): number | undefined {
  switch (schedule.kind) {
    case 'once': {
      const at = Date.parse(schedule.at)
      if (Number.isNaN(at)) return undefined
      return at > afterMs ? at : undefined
    }
    case 'interval': {
      const anchor = Date.parse(schedule.anchor)
      if (Number.isNaN(anchor) || !Number.isSafeInteger(schedule.everyMinutes) || schedule.everyMinutes <= 0) {
        return undefined
      }
      const step = schedule.everyMinutes * 60_000
      // Smallest k with anchor + (k+1)·step > afterMs, i.e. the first tick
      // strictly after the reference point.
      const k = Math.floor((afterMs - anchor) / step)
      let occurrence = anchor + (k + 1) * step
      if (occurrence <= afterMs) occurrence += step
      return occurrence > afterMs ? occurrence : undefined
    }
    case 'daily':
      return nextWallOccurrence(schedule.time, timeZone, afterMs, undefined)
    case 'weekly':
      return nextWallOccurrence(schedule.time, timeZone, afterMs, schedule.weekdays)
    // no default — exhaustive over the friendly union
  }
}

/**
 * The next local wall-clock occurrence of `HH:mm` (optionally restricted to
 * weekdays) after `afterMs`, with DST-skip semantics.
 */
function nextWallOccurrence(
  time: string,
  timeZone: string,
  afterMs: number,
  weekdays: readonly number[] | undefined,
): number | undefined {
  const { hour, minute } = parseWallTime(time)
  // Start the search one local day back so an occurrence earlier "today" but
  // after `afterMs`… can never be missed; the loop advances at most a few days.
  const after = DateTime.fromMillis(afterMs).setZone(timeZone)
  if (!after.isValid) return undefined
  let day = after.minus({ days: 1 }).startOf('day')
  for (let guard = 0; guard < 15; guard += 1) {
    const candidate = day.set({ hour, minute, second: 0, millisecond: 0 })
    // Nonexistent wall time (spring-forward gap): luxon resolves `set` to the
    // nearest valid wall clock (e.g. 02:30 → 03:30), so a wall-time mismatch
    // means the requested time does not exist on this day — skip the day
    // rather than shift the schedule.
    if (candidate.isValid && candidate.hour === hour && candidate.minute === minute) {
      if (candidate.toMillis() > afterMs
        && (weekdays === undefined || weekdays.includes(candidate.weekday))) {
        return candidate.toMillis()
      }
    }
    day = day.plus({ days: 1 })
    if (day.toMillis() - afterMs > 400 * 24 * 3600_000) return undefined
  }
  return undefined
}

/**
 * Enumerate due occurrences strictly greater than `afterMs` and not after
 * `untilMs`, in ascending order. Bounded to keep a long-downed host from
 * enumerating months of backlog: interval cadences step by `everyMinutes`,
 * wall schedules by days. At most `limit` values are produced.
 */
export function dueOccurrences(
  schedule: AutomationSchedule,
  timeZone: string,
  afterMs: number,
  untilMs: number,
  limit = 8,
): number[] {
  const due: number[] = []
  let cursor = afterMs
  for (let guard = 0; guard < limit * 2 + 40; guard += 1) {
    const next = nextOccurrence(schedule, timeZone, cursor)
    if (next === undefined || next > untilMs) break
    due.push(next)
    cursor = next
    if (due.length >= limit) break
  }
  return due
}

/** Human-readable weekday order for summaries (Monday first). */
export const WEEKDAY_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 7]

/** Localized one-line schedule summary for the Web UI and tool results. */
export function describeSchedule(
  schedule: AutomationSchedule,
  timeZone: string,
  lang: 'zh' | 'en',
): string {
  const zone = timeZone === '' ? '' : ` (${timeZone})`
  switch (schedule.kind) {
    case 'once':
      return lang === 'zh'
        ? `一次性：${formatInstant(schedule.at, timeZone ?? 'local')}`
        : `Once at ${formatInstant(schedule.at, timeZone ?? 'local')}`
    case 'interval':
      return lang === 'zh'
        ? `每 ${schedule.everyMinutes} 分钟一次`
        : `Every ${schedule.everyMinutes} minutes`
    case 'daily':
      return lang === 'zh'
        ? `每天 ${schedule.time}${zone}`
        : `Daily at ${schedule.time}${zone}`
    case 'weekly': {
      const names = WEEKDAY_ORDER.filter(day => schedule.weekdays.includes(day))
        .map(day => (lang === 'zh' ? ZH_WEEKDAYS[day - 1] : EN_WEEKDAYS[day - 1]))
      return lang === 'zh'
        ? `每周 ${names.join('、')} ${schedule.time}${zone}`
        : `Weekly on ${names.join(', ')} at ${schedule.time}${zone}`
    }
    // no default — exhaustive
  }
}

const ZH_WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const
const EN_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** Render an ISO instant in the definition's zone with a stable format. */
export function formatInstant(iso: string, timeZone: string): string {
  const parsed = DateTime.fromISO(iso, { setZone: true })
  if (!parsed.isValid) return iso
  return parsed.setZone(timeZone === '' ? 'local' : timeZone).toFormat('yyyy-MM-dd HH:mm')
}
