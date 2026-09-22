/** Orchestration service: durable definitions and runs, the dispatch clock,
 * the execution pool, and recovery semantics. Tick planning lives in
 * `scheduler.ts`, execution in `executor.ts`; this file owns lifecycle and
 * transitions only.
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { nextOccurrence, isValidTimeZone } from './recurrence.ts'
import { planTick } from './scheduler.ts'
import { executeAutomationRun } from './executor.ts'
import { AutomationStore, resolveConfig } from './store.ts'
import {
  toAutomationView,
  validateUpdateInput,
  type AutomationView,
  type RunView,
  type ValidCreateInput,
} from './domain.ts'
import {
  DEFAULT_CONFIG,
  type AutomationConfig,
  type AutomationDefinition,
  type AutomationId,
  type AutomationRun,
  type AutomationSchedule,
  type RunId,
  type RunStatus,
  type RunTrigger,
} from './types.ts'

/** Wall interval between clock ticks; small because the grace window is minutes. */
const TICK_MS = 15_000

/** Bounded recent-run list for the panel snapshot. */
const SNAPSHOT_RUNS_LIMIT = 120

export class ServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export interface SnapshotResult {
  readonly unavailable?: string
  readonly workspace?: {
    readonly id: string
    readonly title: string
    readonly cwd: string
    readonly registered: boolean
  }
  /** Every registered workspace (the editor's 工作区 picker). */
  readonly workspaces?: readonly { readonly id: string; readonly title: string; readonly cwd: string }[]
  readonly automations?: readonly AutomationView[]
  readonly runs?: readonly RunView[]
  readonly policy?: {
    readonly runTimeoutMinutes: number
    readonly misfireGraceMinutes: number
    readonly historyLimit: number
  }
  readonly serverNow?: string
}

export class AutomationService {
  private timer: ReturnType<typeof setInterval> | undefined
  private running = 0
  private alive = false
  private disposed = false
  private readonly queue: RunId[] = []
  private readonly inFlight = new Set<RunId>()
  /** Abort signal for in-flight executions; tripped by dispose so plugin
   * deactivation stops burning agent tokens instead of running to timeout. */
  private readonly runAbort = new AbortController()
  /** Execution promise registry so dispose can drain in-flight runs before
   * the store closes (their terminal writes must not hit a closed domain). */
  private readonly executions = new Set<Promise<void>>()

  private constructor(
    private readonly ctx: Context,
    private readonly store: AutomationStore,
    private readonly config: AutomationConfig,
    private readonly clock: () => number = Date.now,
  ) {}

  /** Open durable storage and return the unstarted service. */
  static async open(
    ctx: Context,
    rawConfig: Partial<AutomationConfig> | undefined,
    clock: () => number = Date.now,
  ): Promise<AutomationService> {
    const store = await AutomationStore.open(ctx.storageDomain)
    return new AutomationService(ctx, store, resolveConfig(rawConfig, DEFAULT_CONFIG), clock)
  }

  /** Recovery semantics + clock start. Idempotent. */
  start(): void {
    if (this.alive || this.disposed) return
    this.alive = true
    void this.recover().then(() => {
      if (!this.alive) return
      void this.tick()
      this.timer = setInterval(() => { void this.tick() }, TICK_MS)
    })
  }

  /** Stop the clock, abort in-flight executions, fail active records, close storage. */
  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
    this.alive = false
    // HMR/plugin-manager contract: release everything before the manager's
    // pnpm remove. Abort first so in-flight agent sessions take their
    // cancellation path, then drain them (their terminal updateRun calls
    // must land before the store closes).
    this.runAbort.abort()
    if (this.executions.size > 0) {
      await Promise.allSettled([...this.executions])
    }
    for (const run of this.store.allRuns()) {
      if (run.status !== 'queued' && run.status !== 'running') continue
      await this.terminalWithoutDispatch(run.id, 'failed', {
        code: 'host_interrupted',
        message: 'Host stopped while this run was queued or running.',
      }).catch(() => undefined)
    }
    await this.store.close()
  }

  /** Crash recovery: durable queued/running records become failed(host_interrupted). */
  private async recover(): Promise<void> {
    for (const run of this.store.allRuns()) {
      if (run.status !== 'queued' && run.status !== 'running') continue
      await this.terminalWithoutDispatch(run.id, 'failed', {
        code: 'host_interrupted',
        message: 'Host restarted while this run was queued or running.',
      }).catch(() => undefined)
    }
    for (const definition of this.store.automations()) {
      await this.store.pruneRetention(definition.id, this.config.historyLimit).catch(() => undefined)
    }
  }

  // ── clock ──────────────────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    if (!this.alive) return
    const now = this.clock()
    const graceMs = this.config.misfireGraceMinutes * 60_000
    for (const definition of this.store.automations()) {
      const cursorMs = this.store.cursor(definition.id) ?? EPOCH_MS
      const decision = planTick({
        nextAfter: after => nextOccurrence(definition.schedule, definition.timeZone, after),
        cursorMs,
        nowMs: now,
        graceMs,
      })
      if (decision.kind === 'idle') continue
      // The cursor is the at-most-once memory: advance past every considered
      // occurrence (dispatched, skipped, or silently dropped while paused).
      await this.store.advanceCursor(definition.id, decision.occurrenceMs)
      if (definition.status !== 'active') continue
      if (decision.kind === 'misfire') {
        await this.recordSkipped(definition, decision.occurrenceMs, 'misfire')
        continue
      }
      if (this.store.hasOccurrence(definition.id, dispatchKey(definition.id, decision.occurrenceMs))) continue
      if (this.store.activeRunsOf(definition.id).length > 0) {
        await this.recordSkipped(definition, decision.occurrenceMs, 'overlap')
        continue
      }
      await this.queueRun(definition, decision.occurrenceMs, 'schedule')
    }
    this.pump()
  }

  /** Immediate recheck after a mutation or external signal. */
  requestTick(): void {
    if (!this.alive) return
    void this.tick()
  }

  private async recordSkipped(
    definition: AutomationDefinition,
    occurrenceMs: number,
    reason: 'overlap' | 'misfire' | 'paused',
  ): Promise<void> {
    await this.store.putRun(this.makeRun(definition, occurrenceMs, 'schedule', reason))
    await this.store.pruneRetention(definition.id, this.config.historyLimit).catch(() => undefined)
  }

  /** A run record without execution facts (skipped occurrence). */
  private makeRun(
    definition: AutomationDefinition,
    occurrenceMs: number,
    trigger: RunTrigger,
    reason: 'overlap' | 'misfire' | 'paused',
  ): AutomationRun {
    const selection = this.resolveSelection(definition.target.modelTarget)
    return {
      id: `krun-${randomUUID()}`,
      automationId: definition.id,
      automationName: definition.name,
      revision: definition.revision,
      trigger,
      status: 'skipped',
      scheduledFor: new Date(occurrenceMs).toISOString(),
      occurrenceKey: dispatchKey(definition.id, occurrenceMs),
      queuedAt: new Date(this.clock()).toISOString(),
      skipReason: reason,
      promptSnapshot: definition.prompt,
      target: {
        workspaceId: definition.target.workspaceId,
        cwd: definition.target.cwd,
        agentPreset: definition.target.agentPreset,
        permission: definition.target.permission,
        provider: selection.provider,
        model: selection.model,
        reasoningEffort: selection.reasoningEffort,
      },
    }
  }

  // ── pool ───────────────────────────────────────────────────────────────────

  /** Dispatch queued runs while capacity and per-automation exclusivity allow. */
  private pump(): void {
    while (this.running < this.config.maxConcurrentRuns && this.queue.length > 0) {
      const runId = this.queue.shift()
      if (runId === undefined) break
      const run = this.store.run(runId)
      if (run === undefined || run.status !== 'queued') continue
      void this.execute(run)
    }
  }

  private async execute(run: AutomationRun): Promise<void> {
    this.running += 1
    this.inFlight.add(run.id)
    const execution = this.executeInner(run)
    this.executions.add(execution)
    try {
      await execution
    } finally {
      this.executions.delete(execution)
    }
  }

  private async executeInner(run: AutomationRun): Promise<void> {
    try {
      const definition = this.store.automation(run.automationId)
      if (definition === undefined) {
        await this.terminalWithoutDispatch(run.id, 'cancelled', {
          code: 'cancelled',
          message: '定义已删除 (the definition was deleted before dispatch)',
        })
        return
      }
      if (definition.status !== 'active' && run.trigger === 'schedule') {
        await this.terminalWithoutDispatch(run.id, 'cancelled', {
          code: 'cancelled',
          message: '定义在派发前被暂停 (the definition was paused before dispatch)',
        })
        return
      }
      const startedAt = new Date(this.clock()).toISOString()
      await this.store.updateRun(run.id, current => ({
        ...current,
        status: 'running',
        startedAt,
      })).catch(() => undefined)
      const completion = await executeAutomationRun(definition, run, {
        ctx: this.ctx,
        runTimeoutMs: this.config.runTimeoutMinutes * 60_000,
        signal: this.runAbort.signal,
      }).catch((error: unknown): import('./executor.ts').RunCompletion => ({
        status: 'failed',
        error: {
          code: 'executor_error',
          message: error instanceof Error ? error.message : String(error),
        },
      }))
      const status: RunStatus = completion.status === 'succeeded' ? 'succeeded'
        : completion.status === 'cancelled' ? 'cancelled' : 'failed'
      // 终态写盘包 catch：dispose 竞态下（abort 后 store 已关闭）不能让
      // 记账失败升级为 unhandled rejection——run 由 dispose 的兜底扫描
      // 标记为 host_interrupted。
      await this.store.updateRun(run.id, current => ({
        ...current,
        status,
        finishedAt: new Date(this.clock()).toISOString(),
        ...(completion.sessionId === undefined ? {} : { sessionId: completion.sessionId }),
        ...(completion.summary === undefined ? {} : { summary: completion.summary }),
        ...(completion.error === undefined ? {} : { error: completion.error }),
      })).catch(() => undefined)
      await this.store.pruneRetention(run.automationId, this.config.historyLimit).catch(() => undefined)
    } finally {
      this.running -= 1
      this.inFlight.delete(run.id)
      this.pump()
    }
  }

  /** Terminal transition for a run that never started executing. */
  private async terminalWithoutDispatch(
    runId: RunId,
    status: 'cancelled' | 'failed',
    error: { code: string; message: string },
  ): Promise<void> {
    await this.store.updateRun(runId, current => ({
      ...current,
      status,
      finishedAt: new Date(this.clock()).toISOString(),
      error,
    })).catch(() => undefined)
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  /** A registered workspace by id (the Web panel's picker validates here). */
  registeredWorkspace(id: string): { readonly path: string; readonly title: string } | undefined {
    const workspace = this.ctx.workspaceRegistry.get(id as never)
    if (workspace === undefined) return undefined
    return { path: workspace.path, title: workspace.title }
  }

  /** Resolve (registering if needed) the workspace bound to a session cwd. */
  async resolveWorkspace(cwd: string): Promise<{ readonly id: string; readonly title: string; readonly path: string }> {
    const existing = this.ctx.workspaceRegistry.list().find(workspace => workspace.path === cwd)
    if (existing !== undefined) {
      return { id: String(existing.id), title: existing.title, path: existing.path }
    }
    const created = await this.ctx.workspaceRegistry.create(cwd)
    return { id: String(created.id), title: created.title, path: created.path }
  }

  /** Create one definition from validated input. */
  async create(input: ValidCreateInput): Promise<AutomationDefinition> {
    if (input.schedule.kind === 'daily' || input.schedule.kind === 'weekly') {
      if (input.timeZone === '' || !isValidTimeZone(input.timeZone)) {
        throw new ServiceError('invalid', 'timeZone must be a valid IANA zone for daily/weekly schedules')
      }
    }
    const now = new Date(this.clock()).toISOString()
    const definition: AutomationDefinition = {
      id: `kauto-${randomUUID()}`,
      revision: 1,
      name: input.name,
      prompt: input.prompt,
      status: 'active',
      schedule: input.schedule,
      timeZone: input.timeZone,
      target: {
        workspaceId: input.workspaceId,
        cwd: input.cwd,
        agentPreset: input.agentPreset,
        permission: input.permission,
        modelTarget: input.modelTarget === null ? null : { ...input.modelTarget },
      },
      createdAt: now,
      updatedAt: now,
    }
    await this.store.putAutomation(definition)
    this.requestTick()
    return definition
  }

  /** Update a definition; bumps the revision so history stays attributable. */
  async update(id: AutomationId, input: ReturnType<typeof validateUpdateInput>): Promise<AutomationDefinition> {
    const definition = this.requireDefinition(id)
    const schedule = input.schedule ?? definition.schedule
    const timeZone = resolveZone(definition.timeZone, input.timeZone, schedule)
    const next: AutomationDefinition = {
      ...definition,
      name: input.name ?? definition.name,
      prompt: input.prompt ?? definition.prompt,
      status: input.status ?? definition.status,
      schedule,
      timeZone,
      target: {
        ...definition.target,
        ...(input.permission === undefined ? {} : { permission: input.permission }),
        ...(input.modelTarget === undefined ? {} : {
          modelTarget: input.modelTarget === null
            ? null
            : {
                provider: input.modelTarget.provider,
                model: input.modelTarget.model,
                reasoningEffort: input.modelTarget.reasoningEffort,
              },
        }),
      },
      updatedAt: new Date(this.clock()).toISOString(),
      revision: definition.revision + 1,
    }
    await this.store.putAutomation(next)
    this.requestTick()
    return next
  }

  /** Pause / resume / delete. Deleting retains run records. */
  async mutate(id: AutomationId, mutation: 'pause' | 'resume' | 'delete'): Promise<void> {
    if (mutation === 'delete') {
      await this.store.deleteAutomation(id)
      return
    }
    const definition = this.requireDefinition(id)
    const status = mutation === 'pause' ? 'paused' : 'active'
    if (definition.status === status) return
    await this.store.putAutomation({
      ...definition,
      status,
      updatedAt: new Date(this.clock()).toISOString(),
    })
    this.requestTick()
  }

  /** Queue one manual occurrence with the same boundary. */
  async runNow(id: AutomationId): Promise<AutomationRun> {
    const definition = this.requireDefinition(id)
    if (this.store.activeRunsOf(id).length > 0) {
      throw new ServiceError('overlap-busy', '该任务已有排队或运行中的执行 (this automation already has an active run)')
    }
    return await this.queueRun(definition, this.clock(), 'manual')
  }

  private async queueRun(
    definition: AutomationDefinition,
    scheduledForMs: number,
    trigger: 'schedule' | 'manual',
  ): Promise<AutomationRun> {
    const selection = this.resolveSelection(definition.target.modelTarget)
    const run: AutomationRun = {
      id: `krun-${randomUUID()}`,
      automationId: definition.id,
      automationName: definition.name,
      revision: definition.revision,
      trigger,
      status: 'queued',
      scheduledFor: new Date(scheduledForMs).toISOString(),
      occurrenceKey: trigger === 'schedule'
        ? dispatchKey(definition.id, scheduledForMs)
        : `${definition.id}|manual|${randomUUID()}`,
      queuedAt: new Date(this.clock()).toISOString(),
      promptSnapshot: definition.prompt,
      target: {
        workspaceId: definition.target.workspaceId,
        cwd: definition.target.cwd,
        agentPreset: definition.target.agentPreset,
        permission: definition.target.permission,
        provider: selection.provider,
        model: selection.model,
        reasoningEffort: selection.reasoningEffort,
      },
    }
    await this.store.putRun(run)
    this.queue.push(run.id)
    this.pump()
    return run
  }

  /** Pinned triple or the live global selection, never a mix of the two. */
  private resolveSelection(modelTarget: import('./types.ts').ModelTarget | null): {
    readonly provider: string
    readonly model: string
    readonly reasoningEffort: string | null
  } {
    if (modelTarget !== null) {
      return {
        provider: modelTarget.provider,
        model: modelTarget.model,
        reasoningEffort: modelTarget.reasoningEffort,
      }
    }
    const live = this.ctx.agentDefaultModel.currentSelection()
    return {
      provider: live.provider,
      model: live.model,
      reasoningEffort: live.reasoningEffort === undefined ? null : live.reasoningEffort,
    }
  }

  private requireDefinition(id: AutomationId): AutomationDefinition {
    const definition = this.store.automation(id)
    if (definition === undefined) throw new ServiceError('not-found', `未找到任务 ${id} (unknown automation)`)
    return definition
  }

  // ── reads ──────────────────────────────────────────────────────────────────

  /** Full panel snapshot scoped to the caller session's workspace cwd. */
  async snapshot(params: {
    readonly sessionId?: string
    readonly lang: 'zh' | 'en'
  }): Promise<SnapshotResult> {
    const cwd = this.cwdForSession(params.sessionId)
    if (cwd === undefined) {
      return { unavailable: 'requires a live source session' }
    }
    let workspace: { id: string; title: string; cwd: string; registered: boolean }
    try {
      const resolved = await this.resolveWorkspace(cwd)
      workspace = { id: resolved.id, title: resolved.title, cwd: resolved.path, registered: true }
    } catch {
      const segments = cwd.split('/').filter(Boolean)
      workspace = {
        id: '',
        title: segments[segments.length - 1] ?? cwd,
        cwd,
        registered: false,
      }
    }
    const workspaces = this.ctx.workspaceRegistry.list().map(registryWorkspace => ({
      id: String(registryWorkspace.id),
      title: registryWorkspace.title,
      cwd: registryWorkspace.path,
    }))
    const views = this.store.automations().map(definition => this.toView(definition, params.lang))
    const byId = new Map(views.map(view => [view.id, view] as const))
    const runs = this.store.allRuns()
      .filter(run => byId.has(run.automationId))
      .sort((a, b) => Date.parse(b.scheduledFor) - Date.parse(a.scheduledFor)
        || Date.parse(b.queuedAt) - Date.parse(a.queuedAt))
      .slice(0, SNAPSHOT_RUNS_LIMIT)
      .map(run => toRunView(run))
    return {
      workspace,
      workspaces,
      automations: views,
      runs,
      policy: {
        runTimeoutMinutes: this.config.runTimeoutMinutes,
        misfireGraceMinutes: this.config.misfireGraceMinutes,
        historyLimit: this.config.historyLimit,
      },
      serverNow: new Date(this.clock()).toISOString(),
    }
  }

  /** Bounded recent runs for one automation (Agent tool surface). */
  listRuns(automationId: AutomationId, limit = 20): readonly AutomationRun[] {
    return this.store.runsOf(automationId).slice(0, Math.max(1, limit))
  }

  /** The creating/owning cwd for a live session, when resolvable. */
  cwdForSession(sessionId: string | undefined): string | undefined {
    if (sessionId === undefined || sessionId.trim() === '') return undefined
    const agent = this.ctx.agents.get(sessionId as never)
    const cwd = agent?.session?.header?.cwd
    return typeof cwd === 'string' && cwd.startsWith('/') ? cwd : undefined
  }

  /** The agent preset composing the caller's live session, when present. */
  agentPresetForSession(sessionId: string | undefined): string | undefined {
    if (sessionId === undefined || sessionId.trim() === '') return undefined
    const agent = this.ctx.agents.get(sessionId as never)
    const preset = agent?.session?.header?.agentPreset
    return typeof preset === 'string' && preset.trim() !== '' ? preset : undefined
  }

  /** Current revision of one definition (optimistic-concurrency check). */
  revisionOf(id: AutomationId): number {
    return this.store.automation(id)?.revision ?? -1
  }

  /** One definition, or undefined. */
  definitionOf(id: AutomationId): AutomationDefinition | undefined {
    return this.store.automation(id)
  }

  /** Workspace-scoped definition views (Agent tool surface). */
  automationsForCwd(cwd: string, lang: 'zh' | 'en' = 'zh'): readonly AutomationView[] {
    return this.store.automations()
      .filter(definition => definition.target.cwd === cwd)
      .map(definition => this.toView(definition, lang))
  }

  /** Wire view of one definition with next-run and last-run facts. */
  toView(definition: AutomationDefinition, lang: 'zh' | 'en'): AutomationView {
    const lastRun = this.store.runsOf(definition.id).find(run => run.status !== 'queued')
    const nextRunAt = definition.status === 'active' ? this.nextRunAtOf(definition) : undefined
    return toAutomationView(definition, {
      lang,
      ...(nextRunAt === undefined ? {} : { nextRunAt }),
      ...(lastRun === undefined ? {} : {
        lastRun: {
          id: lastRun.id,
          scheduledFor: lastRun.scheduledFor,
          status: lastRun.status,
          ...(lastRun.summary === undefined ? {} : { summary: lastRun.summary }),
        },
      }),
    })
  }

  private nextRunAtOf(definition: AutomationDefinition): string | undefined {
    const next = nextOccurrence(definition.schedule, definition.timeZone, this.clock())
    return next === undefined ? undefined : new Date(next).toISOString()
  }
}

const EPOCH_MS = 0

/** Deterministic dispatch key (shared spelling across store lookups). */
function dispatchKey(automationId: string, occurrenceMs: number): string {
  return `${automationId}|${new Date(occurrenceMs).toISOString()}`
}

/** Zone pairing rule for updates: daily/weekly schedules need a valid zone. */
function resolveZone(current: string, update: string | undefined, schedule: AutomationSchedule): string {
  const zone = (update ?? current).trim()
  if (schedule.kind !== 'daily' && schedule.kind !== 'weekly') return zone
  if (zone === '' || !isValidTimeZone(zone)) {
    throw new ServiceError('invalid', 'timeZone must be a valid IANA zone for daily/weekly schedules')
  }
  return zone
}

/** Project a run record to its wire view. */
function toRunView(run: AutomationRun): RunView {
  return {
    id: run.id,
    automationId: run.automationId,
    automationName: run.automationName,
    revision: run.revision,
    trigger: run.trigger,
    status: run.status,
    scheduledFor: run.scheduledFor,
    ...(run.startedAt === undefined ? {} : { startedAt: run.startedAt }),
    ...(run.finishedAt === undefined ? {} : { finishedAt: run.finishedAt }),
    ...(run.sessionId === undefined ? {} : { sessionId: run.sessionId }),
    ...(run.summary === undefined ? {} : { summary: run.summary }),
    ...(run.skipReason === undefined ? {} : { skipReason: run.skipReason }),
    ...(run.error === undefined ? {} : { error: run.error }),
  }
}
