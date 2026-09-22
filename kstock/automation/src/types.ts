/** Domain types for durable automations. Shapes mirror the persistence
 * records exactly; wire projections live in `domain.ts` and the client contract.
 */

/** Branded automation definition id (`kauto-…`). */
export type AutomationId = string
/** Branded run record id (`krun-…`). */
export type RunId = string

/** Two unattended permission modes only; unattended full access is rejected. */
export type AutomationPermission = 'read-only' | 'workspace-write'

export type AutomationStatus = 'active' | 'paused'

/** Trigger provenance of one run occurrence. */
export type RunTrigger = 'schedule' | 'manual'

export type RunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'cancelled'

/** Why a due occurrence was skipped instead of executed. */
export type RunSkipReason = 'overlap' | 'misfire' | 'paused'

/** Why a run did not complete normally. */
export type RunErrorCode =
  | 'workspace_not_found'
  | 'workspace_unavailable'
  | 'timeout'
  | 'cancelled'
  | 'host_interrupted'
  | 'executor_error'
  | 'no_turn_result'
  | 'agent_error'
  | 'turn_aborted'

/** Model target of one definition: a pinned provider/model/effort triple, or
 * `null` to follow the live global selection at run time. */
export interface ModelTarget {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort: string | null
}

/** Validated friendly schedule forms. Times are local `HH:mm` in the
 * definition's IANA zone; `once.at` is an ISO instant; interval cadence is an
 * anchored wall-clock-independent duration. Weekdays use ISO numbering 1..7
 * (Monday first). */
export type AutomationSchedule =
  | { readonly kind: 'once'; readonly at: string }
  | { readonly kind: 'interval'; readonly everyMinutes: number; readonly anchor: string }
  | { readonly kind: 'daily'; readonly time: string }
  | { readonly kind: 'weekly'; readonly time: string; readonly weekdays: readonly number[] }

/** Immutable execution boundary captured at create/update time. */
export interface AutomationTarget {
  readonly workspaceId: string
  readonly cwd: string
  readonly agentPreset: string
  readonly permission: AutomationPermission
  readonly modelTarget: ModelTarget | null
}

/** Durable definition record. `revision` increments on every update so each
 * retained run identifies what it executed. */
export interface AutomationDefinition {
  readonly id: AutomationId
  readonly revision: number
  readonly name: string
  readonly prompt: string
  readonly status: AutomationStatus
  readonly schedule: AutomationSchedule
  readonly timeZone: string
  readonly target: AutomationTarget
  readonly createdAt: string
  readonly updatedAt: string
}

/** One immutable execution target snapshot stored on the run record. */
export interface RunTargetSnapshot {
  readonly workspaceId: string
  readonly cwd: string
  readonly agentPreset: string
  readonly permission: AutomationPermission
  readonly provider: string
  readonly model: string
  readonly reasoningEffort: string | null
}

export interface RunError {
  readonly code: string
  readonly message: string
}

/** Durable run record. `occurrenceKey` makes scheduled dispatch at-most-once. */
export interface AutomationRun {
  readonly id: RunId
  readonly automationId: AutomationId
  readonly automationName: string
  readonly revision: number
  readonly trigger: RunTrigger
  readonly status: RunStatus
  readonly scheduledFor: string
  readonly occurrenceKey: string
  readonly queuedAt: string
  readonly startedAt?: string | undefined
  readonly finishedAt?: string | undefined
  readonly sessionId?: string | undefined
  readonly summary?: string | undefined
  readonly skipReason?: RunSkipReason | undefined
  readonly error?: RunError | undefined
  readonly promptSnapshot: string
  readonly target: RunTargetSnapshot
}

/** Host-wide plugin configuration (cordis config layer). */
export interface AutomationConfig {
  readonly maxConcurrentRuns: number
  readonly runTimeoutMinutes: number
  readonly misfireGraceMinutes: number
  readonly historyLimit: number
}

export const DEFAULT_CONFIG: AutomationConfig = {
  maxConcurrentRuns: 2,
  runTimeoutMinutes: 60,
  misfireGraceMinutes: 15,
  historyLimit: 200,
}

export const INTERVAL_MIN_MINUTES = 5
/** Occurrences older than the grace window are never dispatched. */
export const RUN_SUMMARY_MAX_CHARS = 2_000

/** Resolved due occurrence produced by the recurrence engine. */
export interface DueOccurrence {
  readonly scheduledFor: string
}
