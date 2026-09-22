/** Input validation, invariants, and wire-view projection for durable
 * automations. Runtime-only (no zod): the persistence boundary schemas live in
 * `store.ts`, and this module validates the same facts for create/update
 * traffic from either the Web RPC or the Agent tools.
 */

import { describeSchedule, isValidInstant, isValidTimeZone, isValidWallTime } from './recurrence.ts'
import {
  INTERVAL_MIN_MINUTES,
  type AutomationDefinition,
  type AutomationPermission,
  type AutomationSchedule,
  type AutomationStatus,
  type ModelTarget,
  type RunStatus,
  type RunTrigger,
} from './types.ts'

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

const NAME_MAX = 120
const PROMPT_MAX = 20_000
const ID_PART_MAX = 200
const EFFORT_MAX = 100

const PERMISSIONS: readonly AutomationPermission[] = ['read-only', 'workspace-write']

/** Absolute-posix-path guard shared by host-side callers. */
export function requireAbsolutePath(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new ValidationError(`${field} must be a non-empty string`, field)
  if (!value.startsWith('/')) throw new ValidationError(`${field} must be an absolute path`, field)
  return value
}

function nonEmptyString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`, field)
  const trimmed = value.trim()
  if (trimmed === '') throw new ValidationError(`${field} must be non-empty`, field)
  if (trimmed.length > max) throw new ValidationError(`${field} exceeds ${max} characters`, field)
  return trimmed
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined) return undefined
  return nonEmptyString(value, field, max)
}

/** Validate one friendly schedule payload (already plain JSON). */
export function validateSchedule(raw: unknown, field = 'schedule'): AutomationSchedule {
  if (typeof raw !== 'object' || raw === null) throw new ValidationError(`${field} must be an object`, field)
  const record = raw as Record<string, unknown>
  switch (record.kind) {
    case 'once': {
      const at = record.at
      if (typeof at !== 'string' || !isValidInstant(at)) {
        throw new ValidationError(`${field}.at must be a valid ISO instant`, `${field}.at`)
      }
      return { kind: 'once', at }
    }
    case 'interval': {
      const everyMinutes = record.everyMinutes
      if (typeof everyMinutes !== 'number' || !Number.isSafeInteger(everyMinutes)
        || everyMinutes < INTERVAL_MIN_MINUTES) {
        throw new ValidationError(`${field}.everyMinutes must be an integer ≥ ${INTERVAL_MIN_MINUTES}`, `${field}.everyMinutes`)
      }
      const anchorRaw = record.anchor
      const anchor = typeof anchorRaw === 'string' && isValidInstant(anchorRaw)
        ? anchorRaw
        : new Date().toISOString()
      return { kind: 'interval', everyMinutes, anchor }
    }
    case 'daily': {
      const time = record.time
      if (typeof time !== 'string' || !isValidWallTime(time)) {
        throw new ValidationError(`${field}.time must be HH:mm`, `${field}.time`)
      }
      return { kind: 'daily', time }
    }
    case 'weekly': {
      const time = record.time
      if (typeof time !== 'string' || !isValidWallTime(time)) {
        throw new ValidationError(`${field}.time must be HH:mm`, `${field}.time`)
      }
      if (!Array.isArray(record.weekdays)) {
        throw new ValidationError(`${field}.weekdays must be an array`, `${field}.weekdays`)
      }
      const weekdays = [...new Set(record.weekdays.map((value) => {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 7) {
          throw new ValidationError(`${field}.weekdays entries must be integers 1..7 (Monday first)`, `${field}.weekdays`)
        }
        return value
      }))].sort((a, b) => a - b)
      if (weekdays.length === 0) {
        throw new ValidationError(`${field}.weekdays must contain at least one weekday`, `${field}.weekdays`)
      }
      return { kind: 'weekly', time, weekdays }
    }
    default:
      throw new ValidationError(`${field}.kind must be once | interval | daily | weekly`, `${field}.kind`)
  }
}

/** Validate a pinned model target triple; `null` ("follow global") is decided
 * by the callers, never represented as an empty triple here. */
export function validateModelTarget(raw: unknown, field = 'modelTarget'): ModelTarget {
  if (typeof raw !== 'object' || raw === null) throw new ValidationError(`${field} must be an object`, field)
  const record = raw as Record<string, unknown>
  const provider = nonEmptyString(record.provider, `${field}.provider`, ID_PART_MAX)
  const model = nonEmptyString(record.model, `${field}.model`, ID_PART_MAX)
  if (record.reasoningEffort === undefined || record.reasoningEffort === null) {
    return { provider, model, reasoningEffort: null }
  }
  const effort = nonEmptyString(record.reasoningEffort, `${field}.reasoningEffort`, EFFORT_MAX)
  return { provider, model, reasoningEffort: effort }
}

/** Normalize a possibly-empty zone value: '' stays '' (instant-based). */
export function validateTimeZone(raw: unknown, schedule: AutomationSchedule, field = 'timeZone'): string {
  const value = raw === undefined || raw === null ? '' : raw
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string`, field)
  const trimmed = value.trim()
  if (trimmed === '') {
    if (schedule.kind === 'daily' || schedule.kind === 'weekly') {
      throw new ValidationError(`${field} is required for daily and weekly schedules`, field)
    }
    return ''
  }
  if (trimmed.length > 100 || !isValidTimeZone(trimmed)) {
    throw new ValidationError(`${field} must be a valid IANA time zone`, field)
  }
  return trimmed
}

/** Input accepted by create; every field is already validated. */
export interface ValidCreateInput {
  readonly name: string
  readonly prompt: string
  readonly schedule: AutomationSchedule
  readonly timeZone: string
  readonly workspaceId: string
  readonly cwd: string
  readonly agentPreset: string
  readonly permission: AutomationPermission
  readonly modelTarget: ModelTarget | null
}

/** Validate a create payload (Web RPC and `automation_create` share this). */
export function validateCreateInput(raw: unknown): ValidCreateInput {
  if (typeof raw !== 'object' || raw === null) throw new ValidationError('input must be an object', 'input')
  const record = raw as Record<string, unknown>
  const schedule = validateSchedule(record.schedule)
  const timeZone = validateTimeZone(record.timeZone, schedule)
  const permissionRaw = record.permission
  if (typeof permissionRaw !== 'string' || !PERMISSIONS.includes(permissionRaw as AutomationPermission)) {
    throw new ValidationError('permission must be "read-only" or "workspace-write"', 'permission')
  }
  let modelTarget: ModelTarget | null = null
  if (record.modelTarget !== undefined && record.modelTarget !== null) {
    modelTarget = validateModelTarget(record.modelTarget)
  }
  return {
    name: nonEmptyString(record.name, 'name', NAME_MAX),
    prompt: nonEmptyString(record.prompt, 'prompt', PROMPT_MAX),
    schedule,
    timeZone,
    workspaceId: nonEmptyString(record.workspaceId, 'workspaceId', ID_PART_MAX),
    cwd: requireAbsolutePath(record.cwd, 'cwd'),
    agentPreset: nonEmptyString(record.agentPreset, 'agentPreset', ID_PART_MAX),
    permission: permissionRaw as AutomationPermission,
    modelTarget,
  }
}

/** Validate a partial update payload; `undefined` keys mean "unchanged". */
export interface ValidUpdateInput {
  readonly name?: string
  readonly prompt?: string
  readonly schedule?: AutomationSchedule
  readonly timeZone?: string
  readonly status?: 'active' | 'paused'
  readonly permission?: AutomationPermission
  readonly modelTarget?: ModelTarget | null
}

export function validateUpdateInput(raw: unknown): ValidUpdateInput {
  if (typeof raw !== 'object' || raw === null) throw new ValidationError('input must be an object', 'input')
  const record = raw as Record<string, unknown>
  const update: {
    name?: string
    prompt?: string
    schedule?: AutomationSchedule
    timeZone?: string
    status?: 'active' | 'paused'
    permission?: AutomationPermission
    modelTarget?: ModelTarget | null
  } = {}
  if (record.name !== undefined) update.name = nonEmptyString(record.name, 'name', NAME_MAX)
  if (record.prompt !== undefined) update.prompt = nonEmptyString(record.prompt, 'prompt', PROMPT_MAX)
  if (record.schedule !== undefined) update.schedule = validateSchedule(record.schedule)
  if (record.status !== undefined) {
    if (record.status !== 'active' && record.status !== 'paused') {
      throw new ValidationError('status must be "active" or "paused"', 'status')
    }
    update.status = record.status
  }
  if (record.permission !== undefined) {
    if (typeof record.permission !== 'string'
      || !PERMISSIONS.includes(record.permission as AutomationPermission)) {
      throw new ValidationError('permission must be "read-only" or "workspace-write"', 'permission')
    }
    update.permission = record.permission as AutomationPermission
  }
  if (record.modelTarget !== undefined) {
    update.modelTarget = record.modelTarget === null
      ? null
      : validateModelTarget(record.modelTarget)
  }
  if (record.timeZone !== undefined) {
    // Zone validity is checked against the merged schedule by the service
    // (an omitted schedule keeps the definition's current one).
    const zone = record.timeZone
    if (typeof zone !== 'string' || zone.length > 100) {
      throw new ValidationError('timeZone must be a short IANA zone string', 'timeZone')
    }
    update.timeZone = zone.trim()
  }
  return update
}

/** Zone/schedule pairing rule applied where both the current definition and
 * the update are known: a daily/weekly schedule requires a valid IANA zone. */
export function resolveZone(
  currentZone: string,
  updateZone: string | undefined,
  schedule: AutomationSchedule,
): string {
  const zone = (updateZone ?? currentZone).trim()
  if (schedule.kind !== 'daily' && schedule.kind !== 'weekly') return zone
  if (zone === '' || !isValidTimeZone(zone)) {
    throw new ValidationError('timeZone must be a valid IANA time zone for daily and weekly schedules', 'timeZone')
  }
  return zone
}

/** Deterministic dispatch key: one recorded occurrence can never run twice. */
export function occurrenceKey(automationId: string, scheduledForMs: number): string {
  return `${automationId}|${new Date(scheduledForMs).toISOString()}`
}

/** Bound a run summary to the durable record size. */
export function boundSummary(value: string): string | undefined {
  const normalized = value.trim()
  if (normalized === '') return undefined
  return normalized.length <= 2_000 ? normalized : `${normalized.slice(0, 1_999)}…`
}

/** Wire view of one definition with its freshest run facts resolved. */
export interface AutomationView {
  readonly id: string
  readonly revision: number
  readonly name: string
  readonly prompt: string
  readonly status: 'active' | 'paused'
  readonly schedule: AutomationSchedule
  readonly scheduleSummary: string
  readonly timeZone: string
  readonly permission: AutomationPermission
  readonly workspaceId: string
  readonly cwd: string
  readonly agentPreset: string
  readonly model: { readonly provider: string; readonly model: string; readonly reasoningEffort: string | null } | null
  readonly nextRunAt?: string
  readonly lastRunAt?: string
  readonly lastRunStatus?: RunStatus
  readonly lastRunId?: string
  readonly lastRunSummary?: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface RunView {
  readonly id: string
  readonly automationId: string
  readonly automationName: string
  readonly revision: number
  readonly trigger: RunTrigger
  readonly status: RunStatus
  readonly scheduledFor: string
  readonly startedAt?: string
  readonly finishedAt?: string
  readonly sessionId?: string
  readonly summary?: string
  readonly skipReason?: string
  readonly error?: { readonly code: string; readonly message: string }
}

/** Project a definition to its wire view. */
export function toAutomationView(
  definition: AutomationDefinition,
  options: {
    readonly lang: 'zh' | 'en'
    readonly nextRunAt?: string
    readonly lastRun?: {
      readonly id: string
      readonly scheduledFor: string
      readonly status: RunStatus
      readonly summary?: string
    }
  },
): AutomationView {
  return {
    id: definition.id,
    revision: definition.revision,
    name: definition.name,
    prompt: definition.prompt,
    status: definition.status,
    schedule: definition.schedule,
    scheduleSummary: describeSchedule(definition.schedule, definition.timeZone, options.lang),
    timeZone: definition.timeZone,
    permission: definition.target.permission,
    workspaceId: definition.target.workspaceId,
    cwd: definition.target.cwd,
    agentPreset: definition.target.agentPreset,
    model: definition.target.modelTarget === null ? null : {
      provider: definition.target.modelTarget.provider,
      model: definition.target.modelTarget.model,
      reasoningEffort: definition.target.modelTarget.reasoningEffort,
    },
    ...(options.nextRunAt === undefined ? {} : { nextRunAt: options.nextRunAt }),
    ...(options.lastRun === undefined ? {} : {
      lastRunAt: options.lastRun.scheduledFor,
      lastRunStatus: options.lastRun.status,
      lastRunId: options.lastRun.id,
      ...(options.lastRun.summary === undefined ? {} : { lastRunSummary: options.lastRun.summary }),
    }),
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
  }
}
