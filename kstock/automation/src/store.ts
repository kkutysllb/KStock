/** Durable persistence over the storage-domain form: automation definitions,
 * run records, and per-automation dispatch cursors. The spec's zod schemas are
 * the durable boundary; the store adds CRUD orchestration and retention.
 */

import z from 'zod'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import type {
  AutomationConfig,
  AutomationDefinition,
  AutomationId,
  AutomationRun,
  AutomationSchedule,
  ModelTarget,
  RunId,
} from './types.ts'

// ── durable schemas (lossless JSON at the storage boundary) ──────────────────

const instantSchema = z.string().refine(value => !Number.isNaN(Date.parse(value)), 'ISO instant')
const wallTimeSchema = z.string().regex(/^([01]?\d|2[0-3]):([0-5]\d)$/)
const nonEmptySchema = z.string().min(1)

const modelTargetSchema: z.ZodType<ModelTarget> = z.object({
  provider: nonEmptySchema,
  model: nonEmptySchema,
  reasoningEffort: z.string().min(1).nullable(),
})

const scheduleSchema: z.ZodType<AutomationSchedule> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('once'), at: instantSchema }),
  z.object({
    kind: z.literal('interval'),
    everyMinutes: z.number().int(),
    anchor: instantSchema,
  }),
  z.object({ kind: z.literal('daily'), time: wallTimeSchema }),
  z.object({
    kind: z.literal('weekly'),
    time: wallTimeSchema,
    weekdays: z.array(z.number().int().min(1).max(7)).min(1),
  }),
])

const targetSchema = z.object({
  workspaceId: nonEmptySchema,
  cwd: nonEmptySchema,
  agentPreset: nonEmptySchema,
  permission: z.enum(['read-only', 'workspace-write']),
  modelTarget: modelTargetSchema.nullable(),
})

export const automationDefinitionSchema: z.ZodType<AutomationDefinition> = z.object({
  id: nonEmptySchema,
  revision: z.number().int().min(1),
  name: nonEmptySchema,
  prompt: nonEmptySchema,
  status: z.enum(['active', 'paused']),
  schedule: scheduleSchema,
  timeZone: z.string().max(100),
  target: targetSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
})

const runErrorSchema = z.object({ code: nonEmptySchema, message: z.string().min(1) })

const runTargetSchema = z.object({
  workspaceId: nonEmptySchema,
  cwd: nonEmptySchema,
  agentPreset: nonEmptySchema,
  permission: z.enum(['read-only', 'workspace-write']),
  provider: nonEmptySchema,
  model: nonEmptySchema,
  reasoningEffort: z.string().min(1).nullable(),
})

export const automationRunSchema: z.ZodType<AutomationRun> = z.object({
  id: nonEmptySchema,
  automationId: nonEmptySchema,
  automationName: nonEmptySchema,
  revision: z.number().int().min(1),
  trigger: z.enum(['schedule', 'manual']),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'skipped', 'cancelled']),
  scheduledFor: instantSchema,
  occurrenceKey: nonEmptySchema,
  queuedAt: instantSchema,
  startedAt: instantSchema.optional(),
  finishedAt: instantSchema.optional(),
  sessionId: nonEmptySchema.optional(),
  summary: z.string().optional(),
  skipReason: z.enum(['overlap', 'misfire', 'paused']).optional(),
  error: runErrorSchema.optional(),
  promptSnapshot: z.string().min(1),
  target: runTargetSchema,
})

const cursorSchema = z.object({
  /** The most recent occurrence this automation considered (ISO instant). */
  lastOccurrence: instantSchema,
})

/** Domain layout. Name matches the storage unit-name pattern; `single` keeps
 * every table in one validated document per unit. The spec is the plain
 * declaration object (`defineDomain`/`domainTable` are validation identity
 * helpers, inlined here to keep the bundle free of `@deepseek-ai/*` runtime
 * imports); the framework facility validates the same invariants at open. */
export const automationDomainSpec = {
  name: 'kylin_automation',
  version: 1,
  tables: {
    automations: { valueSchema: automationDefinitionSchema },
    runs: { valueSchema: automationRunSchema },
    cursors: { valueSchema: cursorSchema },
  },
} as const

// ── store ────────────────────────────────────────────────────────────────────

export interface OpenedAutomationDomain extends Domain<typeof automationDomainSpec> {}

/** Typed CRUD over the opened domain plus retention and recovery queries. */
export class AutomationStore {
  private constructor(private readonly domain: Domain<typeof automationDomainSpec>) {}

  /** Open the durable domain. The caller owns the handle (ctx.effect disposer). */
  static async open(facility: {
    open<S extends import('@deepseek-ai/dsh-storage-domain').DomainSpec>(
      spec: S,
    ): Promise<Domain<S>>
  }): Promise<AutomationStore> {
    const domain = await facility.open(automationDomainSpec)
    return new AutomationStore(domain as Domain<typeof automationDomainSpec>)
  }

  async close(): Promise<void> {
    await this.domain.close()
  }

  // ── definitions ────────────────────────────────────────────────────────────

  automations(): AutomationDefinition[] {
    return [...this.automationTable().entries()]
      .map(([, definition]) => definition)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  }

  automation(id: AutomationId): AutomationDefinition | undefined {
    return this.automationTable().get(id)
  }

  async putAutomation(definition: AutomationDefinition): Promise<void> {
    await this.automationTable().put(definition.id, definition)
  }

  async deleteAutomation(id: AutomationId): Promise<boolean> {
    const removed = await this.automationTable().delete(id)
    await this.cursorTable().delete(id)
    return removed
  }

  private automationTable() {
    return this.domain.table('automations') as import('@deepseek-ai/dsh-storage-domain').KvTable<string, AutomationDefinition>
  }

  // ── runs ───────────────────────────────────────────────────────────────────

  run(id: RunId): AutomationRun | undefined {
    return this.runTable().get(id)
  }

  /** Runs of one automation, newest first. */
  runsOf(automationId: AutomationId): AutomationRun[] {
    return [...this.runTable().entries()]
      .map(([, run]) => run)
      .filter(run => run.automationId === automationId)
      .sort((a, b) => Date.parse(b.scheduledFor) - Date.parse(a.scheduledFor)
        || Date.parse(b.queuedAt) - Date.parse(a.queuedAt))
  }

  /** All runs in stored order (diagnostics + recovery). */
  allRuns(): AutomationRun[] {
    return [...this.runTable().entries()].map(([, run]) => run)
  }

  /** Active (queued or running) runs of one automation. */
  activeRunsOf(automationId: AutomationId): AutomationRun[] {
    return this.runsOf(automationId).filter(run => run.status === 'queued' || run.status === 'running')
  }

  /** Whether this exact scheduled occurrence was already recorded. */
  hasOccurrence(automationId: AutomationId, key: string): boolean {
    for (const run of this.runsOf(automationId)) {
      if (run.occurrenceKey === key) return true
    }
    return false
  }

  async putRun(run: AutomationRun): Promise<void> {
    await this.runTable().put(run.id, run)
  }

  /** Atomic terminal-state transition (queued/running → terminal). */
  async updateRun(id: RunId, patch: (current: AutomationRun) => AutomationRun): Promise<AutomationRun> {
    return await this.runTable().update(id, patch)
  }

  /** Enforce per-automation terminal-run retention. Active records are never pruned. */
  async pruneRetention(automationId: AutomationId, historyLimit: number): Promise<void> {
    const terminal = this.runsOf(automationId).filter(run =>
      run.status !== 'queued' && run.status !== 'running')
    if (terminal.length <= historyLimit) return
    for (const run of terminal.slice(historyLimit)) {
      await this.runTable().delete(run.id)
    }
  }

  /** Delete one terminal run record (历史管理). Active runs are refused. */
  async deleteRun(id: RunId): Promise<boolean> {
    const run = this.runTable().get(id)
    if (run === undefined) return false
    if (run.status === 'queued' || run.status === 'running') return false
    return this.runTable().delete(id)
  }

  /** Delete every terminal run of one automation; returns the cleared count. */
  async clearRuns(automationId: AutomationId): Promise<number> {
    const terminal = this.runsOf(automationId).filter(run =>
      run.status !== 'queued' && run.status !== 'running')
    for (const run of terminal) {
      await this.runTable().delete(run.id)
    }
    return terminal.length
  }

  private runTable() {
    return this.domain.table('runs') as import('@deepseek-ai/dsh-storage-domain').KvTable<string, AutomationRun>
  }

  // ── dispatch cursors ───────────────────────────────────────────────────────

  cursor(id: AutomationId): number | undefined {
    const record = this.cursorTable().get(id)
    if (record === undefined) return undefined
    const parsed = Date.parse(record.lastOccurrence)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  /** Monotonic cursor advance; concurrent advances never regress. */
  async advanceCursor(id: AutomationId, occurrenceMs: number): Promise<void> {
    const iso = new Date(occurrenceMs).toISOString()
    const current = this.cursorTable().get(id)
    if (current !== undefined && Date.parse(current.lastOccurrence) >= occurrenceMs) return
    await this.cursorTable().put(id, { lastOccurrence: iso })
  }

  private cursorTable() {
    return this.domain.table('cursors') as import('@deepseek-ai/dsh-storage-domain').KvTable<string, { lastOccurrence: string }>
  }
}

/** Validate + default the cordis config values at apply time. */
export function resolveConfig(raw: Partial<AutomationConfig> | undefined, defaults: AutomationConfig): AutomationConfig {
  const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
    const n = typeof value === 'number' && Number.isSafeInteger(value) ? value : fallback
    return Math.min(max, Math.max(min, n))
  }
  return {
    maxConcurrentRuns: clampInt(raw?.maxConcurrentRuns, 1, 32, defaults.maxConcurrentRuns),
    runTimeoutMinutes: clampInt(raw?.runTimeoutMinutes, 1, 1_440, defaults.runTimeoutMinutes),
    misfireGraceMinutes: clampInt(raw?.misfireGraceMinutes, 0, 525_600, defaults.misfireGraceMinutes),
    historyLimit: clampInt(raw?.historyLimit, 1, 5_000, defaults.historyLimit),
  }
}
