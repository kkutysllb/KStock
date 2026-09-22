/** Recurrence engine tests: once/interval/daily/weekly semantics, DST skip,
 * due enumeration bounds, and summaries.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import type { AutomationSchedule } from '../src/types.ts'
import {
  describeSchedule,
  dueOccurrences,
  isValidTimeZone,
  isValidWallTime,
  nextOccurrence,
  parseWallTime,
} from '../src/recurrence.ts'

const ZONE = 'Asia/Shanghai'
const MS = (iso: string): number => Date.parse(iso)

test('once fires at its instant and never again', () => {
  const schedule: AutomationSchedule = { kind: 'once', at: '2026-03-05T09:00:00.000Z' }
  assert.equal(nextOccurrence(schedule, ZONE, MS('2026-03-01T00:00:00Z')), MS('2026-03-01T00:00:00Z') < MS(schedule.at) ? MS(schedule.at) : undefined)
  assert.equal(nextOccurrence(schedule, ZONE, MS('2026-03-05T09:00:00.000Z')), undefined)
})

test('interval cadence is anchored and duration-pure', () => {
  const anchor = '2026-01-01T00:00:00.000Z'
  const schedule: AutomationSchedule = { kind: 'interval', everyMinutes: 30, anchor }
  // First tick after one full interval from the anchor.
  assert.equal(nextOccurrence(schedule, ZONE, MS(anchor)), MS(anchor) + 30 * 60_000)
  // A reference in the middle of a step resolves to the next boundary.
  assert.equal(nextOccurrence(schedule, ZONE, MS(anchor) + 30 * 60_000 + 1), MS(anchor) + 60 * 60_000)
})

test('daily fires at local wall time and advances day by day', () => {
  const schedule: AutomationSchedule = { kind: 'daily', time: '09:30' }
  const first = nextOccurrence(schedule, ZONE, MS('2026-03-04T00:30:00.000Z'))
  assert.ok(first !== undefined)
  const firstLocal = new Date(first).toLocaleString('en-US', { timeZone: ZONE, hour12: false })
  assert.match(firstLocal, /3\/4\/2026/)
  assert.match(firstLocal, /:30:/)
  const second = nextOccurrence(schedule, ZONE, first)
  assert.ok(second !== undefined && second > first)
})

test('daily skips nonexistent DST wall times (spring forward)', () => {
  // In America/New_York 2026-03-08 02:30 local does not exist (2:00→3:00 jump).
  const schedule: AutomationSchedule = { kind: 'daily', time: '02:30' }
  const zone = 'America/New_York'
  const first = nextOccurrence(schedule, zone, MS('2026-03-07T12:00:00.000Z'))
  assert.ok(first !== undefined)
  const firstLocal = new Date(first).toLocaleString('en-US', { timeZone: zone, hour12: false })
  // Skipped to the NEXT valid day, not shifted to 03:30.
  assert.doesNotMatch(firstLocal, /3\/8\/2026/)
})

test('weekly restricts to weekdays and keeps Monday-first ordering', () => {
  const schedule: AutomationSchedule = { kind: 'weekly', time: '09:00', weekdays: [1, 3, 5] }
  // 2026-03-07 is a Saturday; the next hit is Monday 2026-03-09 09:00 CST.
  const next = nextOccurrence(schedule, ZONE, MS('2026-03-07T02:00:00.000Z'))
  assert.ok(next !== undefined)
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'short' }).format(new Date(next))
  assert.equal(weekday, 'Mon')
})

test('dueOccurrences enumerates ascending and is bounded', () => {
  const schedule: AutomationSchedule = { kind: 'interval', everyMinutes: 10, anchor: '2026-01-01T00:00:00.000Z' }
  const after = MS('2026-01-01T00:00:00.000Z')
  const until = after + 8 * 30 * 60_000
  const due = dueOccurrences(schedule, ZONE, after, until, 4)
  assert.equal(due.length, 4)
  for (let i = 1; i < due.length; i += 1) assert.ok((due[i] as number) > (due[i - 1] as number))
  // A misfire beyond the enumeration cap yields fewer occurrences than elapsed.
  const farUntil = after + 50 * 30 * 60_000
  assert.ok(dueOccurrences(schedule, ZONE, after, farUntil, 3).length <= 3)
})

test('wall-time and zone validators', () => {
  assert.equal(isValidWallTime('09:30'), true)
  assert.equal(isValidWallTime('24:00'), false)
  assert.equal(isValidWallTime('9:5'), false)
  assert.equal(isValidTimeZone(ZONE), true)
  assert.equal(isValidTimeZone('Mars/Olympus'), false)
  assert.deepEqual(parseWallTime('09:30'), { hour: 9, minute: 30 })
})

test('schedule summaries are localized', () => {
  assert.equal(
    describeSchedule({ kind: 'daily', time: '09:30' }, ZONE, 'zh'),
    '每天 09:30 (Asia/Shanghai)',
  )
  assert.equal(
    describeSchedule({ kind: 'weekly', time: '09:30', weekdays: [1, 3] }, ZONE, 'en'),
    'Weekly on Mon, Wed at 09:30 (Asia/Shanghai)',
  )
  assert.equal(describeSchedule({ kind: 'interval', everyMinutes: 15, anchor: '2026-01-01T00:00:00Z' }, '', 'zh'), '每 15 分钟一次')
})
