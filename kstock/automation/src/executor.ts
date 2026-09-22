/** Fresh-Agent execution boundary for one already-claimed automation run.
 *
 * Each dispatched occurrence receives a new Session and a fresh root Agent
 * that owns none of the creating conversation's history, inbox, grants, or
 * past approvals. Policy is installed before publication: two permission
 * modes only, `approval policy = never` (fail closed), and an explicit
 * capability allowlist enforced by an agent-scoped final guard.
 *
 * Deployment note (KCoder packaged harness): plugin bundles resolve their
 * imports through plain Node ESM, so this file must not import `@deepseek-ai/*`
 * at run time — the framework behaviors it needs (sandbox mode, approval
 * policy, prompt source message, pinned model selection) are inline replays of
 * the corresponding framework one-liners, verified against the same version.
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionEventLike } from '@deepseek-ai/dsh-session'
import type { AutomationDefinition, AutomationRun, RunError } from './types.ts'

/** Coding-tool allowlist for unattended runs. Everything interactive
 * (questions, plans, goals, nested agents, recursive automation management,
 * background jobs) is denied here. */
export const UNATTENDED_TOOL_ALLOWLIST: ReadonlySet<string> = new Set([
  'run_code',
  'bash', 'pwsh',
  'read', 'read_image', 'write', 'edit', 'str_replace_editor',
  'glob', 'grep', 'lsp',
  'web_search', 'web_fetch',
  'skill',
  'session_search', 'session_trace',
])

/** Final scoped denial reason for one tool call, or `undefined` to allow. */
export function unattendedToolGuardReason(name: string, args: unknown): string | undefined {
  if ((name === 'bash' || name === 'pwsh') && typeof args === 'object' && args !== null
    && (args as Record<string, unknown>)['run_in_background'] === true) {
    return '后台进程在无人值守的定时任务运行中不可用 (background processes are unavailable inside an unattended automation run)'
  }
  if (name === 'automation_create' || name === 'automation_update' || name === 'automation_run_now' || name === 'automation_delete') {
    return '定时任务运行内部不能递归管理自动化 (recursive automation management is denied inside an unattended run)'
  }
  return UNATTENDED_TOOL_ALLOWLIST.has(name)
    ? undefined
    : `工具 '${name}' 不在无人值守能力允许清单内 (not in the unattended automation capability allowlist)`
}

export interface RunCompletion {
  readonly sessionId?: string
  readonly status: 'succeeded' | 'failed' | 'cancelled'
  readonly summary?: string
  readonly error?: RunError
}

interface TextBlock {
  readonly type: string
  readonly text?: unknown
}

/** Last assistant text and the closed-turn reason of the interval this run owns. */
export function summarizeRun(
  events: readonly SessionEventLike[],
  firstSeq: number,
): { readonly text: string; readonly reason?: Record<string, any> } {
  let started = false
  let text = ''
  let reason: Record<string, any> | undefined
  for (const event of events) {
    if (event.seq < firstSeq) continue
    if (event.type === 'turn/start') {
      started = true
      continue
    }
    if (!started) continue
    if (event.type === 'assistant/message') {
      const content = (event.data as { message?: { content?: readonly TextBlock[] } }).message?.content
      if (Array.isArray(content)) {
        const joined = content
          .filter(block => block.type === 'text' && typeof block.text === 'string')
          .map(block => String(block.text))
          .join('')
        if (joined !== '') text = joined
      }
    }
    if (event.type === 'turn/end') {
      reason = (event.data as { reason?: Record<string, any> }).reason
    }
  }
  return { text, ...(reason === undefined ? {} : { reason }) }
}

/** Map a closed-turn reason to the durable run error. */
export function reasonToError(reason: Record<string, any> | undefined): RunError {
  if (reason === undefined) {
    return { code: 'no_turn_result', message: '定时任务没有产生已闭合的回合 (the automation produced no closed turn)' }
  }
  if (reason.kind === 'error') {
    const failure = reason.error
    return {
      code: typeof failure?.code === 'string' ? failure.code : 'agent_error',
      message: typeof failure?.message === 'string' ? failure.message : 'The automation Agent failed.',
    }
  }
  if (reason.kind === 'aborted') {
    return { code: 'turn_aborted', message: '运行被取消 (the automation turn was aborted)' }
  }
  return { code: `turn_${String(reason.kind)}`, message: `运行以 ${String(reason.kind)} 结束 (the automation ended with ${String(reason.kind)})` }
}

/** Resolved model selection for one run: pinned target or the live default. */
export function modelSelectionForRun(
  target: AutomationRun['target'],
  fallback: { provider: string; model: string; reasoningEffort?: string | undefined },
): { provider: string; model: string; reasoningEffort?: string | undefined } {
  if (target.reasoningEffort === null) {
    return { provider: target.provider, model: target.model }
  }
  return { provider: target.provider, model: target.model, reasoningEffort: target.reasoningEffort }
}

export interface ExecutorDeps {
  /** Host context (agents / workspaceRegistry / sessions / presets / …). */
  readonly ctx: Context
  readonly runTimeoutMs: number
  readonly signal?: AbortSignal
  /** Test seam for wall-clock-dependent deadlines. */
  readonly setTimeoutImpl?: typeof setTimeout
}

/**
 * Execute exactly one durable run in a fresh root Agent and Session. The new
 * Session owns no source-chat history or grant; sandbox mode, approval policy,
 * and the capability guard are installed before publication.
 */
export async function executeAutomationRun(
  definition: AutomationDefinition,
  run: AutomationRun,
  deps: ExecutorDeps,
): Promise<RunCompletion> {
  const { ctx } = deps
  if (deps.signal?.aborted === true) {
    return {
      status: 'cancelled',
      error: { code: 'cancelled', message: '宿主已停止，任务未启动 (cancelled before it started)' },
    }
  }
  const target = run.target
  const workspace = ctx.workspaceRegistry.get(target.workspaceId as never)
  if (workspace === undefined) {
    return {
      status: 'failed',
      error: { code: 'workspace_not_found', message: '目标工作区已不存在 (the target workspace no longer exists)' },
    }
  }
  if (await workspace.status() !== 'ok' || workspace.path !== target.cwd) {
    return {
      status: 'failed',
      error: { code: 'workspace_unavailable', message: '目标工作区目录不可用或已变更 (the target workspace directory is unavailable or changed)' },
    }
  }

  // A pinned definition carries a complete provider/model/effort triple; a
  // follower resolves the live global selection as one coherent unit. The two
  // are never mixed: a default model's effort is not grafted onto another model.
  const liveSelection = ctx.agentDefaultModel.currentSelection()
  const selection = modelSelectionForRun(
    target,
    { provider: liveSelection.provider, model: liveSelection.model, reasoningEffort: liveSelection.reasoningEffort },
  )
  // Agents and Sessions share one identity; the id is a plain string here
  // (SessionId/WorkspaceId brands are compile-time only).
  const sessionId = run.id.replace(/^krun-/, 'kauto-session-')
  let handle: Awaited<ReturnType<Context['agents']['create']>> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let removeCancellationListener: () => void = () => {}
  const setTimeoutImpl = deps.setTimeoutImpl ?? setTimeout
  try {
    handle = await ctx.agents.withoutInitiator(() => ctx.agents.create({
      sessionId: sessionId as never,
      ...(deps.signal === undefined ? {} : { signal: deps.signal }),
      meta: { cwd: target.cwd, agentPreset: target.agentPreset },
      agentOptions: { provider: selection.provider, model: selection.model },
      // The setup callback receives the scoped Agent as its second parameter
      // (fail-closed `agentCtx.agent` access requires an injected service).
      setup: async (agentCtx, agent) => {
        await ctx.agentPresets.mount(agentCtx, target.agentPreset)
        if (selection.reasoningEffort !== undefined) {
          installInitialEffort(agentCtx, selection.reasoningEffort, selection.provider, selection.model)
        }
        // Inline replays of the framework one-liners (dsh-sandbox-policy /
        // dsh-user-approval): durable session-level policy events.
        agent.session.append('sandbox/mode', { mode: target.permission })
        agent.session.append('approval/policy', { policy: 'never' })
        agentCtx.tools.guard(exec => unattendedToolGuardReason(exec.name, exec.arguments))
      },
    }))
    await handle.agent.whenIdle()
    await workspace.attachSession(sessionId)
    if (definition.name.trim() !== '') {
      ctx.sessionTitle.rename(handle.agent.session, definition.name.trim())
    }
    const firstSeq = handle.agent.session.seq
    handle.agent.followup(createAutomationPromptMessage(run.promptSnapshot, {
      kind: 'automation',
      automationId: definition.id,
      runId: run.id,
      scheduledFor: run.scheduledFor,
      trigger: run.trigger,
      form: 'notice',
      summary: `automation "${definition.name}" run ${run.id}`,
    }))

    let timedOut = false
    let aborted = false
    const idle = handle.agent.whenIdle()
    const deadline = new Promise<void>((resolve) => {
      timeout = setTimeoutImpl(() => {
        timedOut = true
        handle?.agent.cancel({ kind: 'hook', reason: 'automation run timeout' })
        resolve()
      }, deps.runTimeoutMs)
    })
    const cancellation = new Promise<void>((resolve) => {
      const signal = deps.signal
      if (signal === undefined) return
      const cancel = (): void => {
        aborted = true
        handle?.agent.cancel({ kind: 'hook', reason: 'automation owner disposed' })
        resolve()
      }
      if (signal.aborted) cancel()
      else {
        signal.addEventListener('abort', cancel, { once: true })
        removeCancellationListener = () => { signal.removeEventListener('abort', cancel) }
      }
    })
    await Promise.race([idle, deadline, cancellation])
    removeCancellationListener()
    if (timedOut || aborted) await handle.agent.whenIdle()
    if (timeout !== undefined) clearTimeout(timeout)
    await ctx.sessions.flush(handle.agent.session)
    const outcome = summarizeRun(handle.agent.session.snapshotEvents(firstSeq), firstSeq)
    const summary = boundSummaryText(outcome.text)
    if (aborted) {
      return {
        sessionId: String(sessionId),
        status: 'cancelled',
        ...(summary === undefined ? {} : { summary }),
        error: { code: 'cancelled', message: '宿主停止导致任务取消 (cancelled because its owner stopped)' },
      }
    }
    if (timedOut) {
      return {
        sessionId: String(sessionId),
        status: 'failed',
        ...(summary === undefined ? {} : { summary }),
        error: { code: 'timeout', message: '运行超出时间上限 (the automation exceeded its run time limit)' },
      }
    }
    if (outcome.reason?.kind === 'completed') {
      return { sessionId: String(sessionId), status: 'succeeded', ...(summary === undefined ? {} : { summary }) }
    }
    return {
      sessionId: String(sessionId),
      status: 'failed',
      ...(summary === undefined ? {} : { summary }),
      error: reasonToError(outcome.reason),
    }
  } catch (error: unknown) {
    return {
      ...(handle === undefined ? {} : { sessionId: String(sessionId) }),
      status: 'failed',
      error: {
        code: 'executor_error',
        message: error instanceof Error ? error.message : 'The automation executor failed.',
      },
    }
  } finally {
    removeCancellationListener()
    if (timeout !== undefined) clearTimeout(timeout)
    await handle?.dispose().catch(() => {})
  }
}


// ── inline framework-behavior replays (no @deepseek-ai/* runtime imports) ────

/**
 * Pin the model's reasoning effort for the exact pinned route (the webhook
 * plugin's installInitialModelSelection pattern). The agent/request waterfall
 * resolves the call config; this interceptor overrides the effort only on the
 * pinned provider/model route, never grafting an effort onto another model.
 */
function installInitialEffort(agentCtx: Context, effort: string, provider: string, model: string): void {
  agentCtx.on('agent/request', async (_payload: unknown, next: () => Promise<unknown>) => {
    const resolved = await next() as { provider?: string; model?: string; reasoningEffort?: string }
    if (resolved.provider !== provider || resolved.model !== model) return resolved
    return { ...resolved, reasoningEffort: effort }
  })
}

/** Build the frozen user-role prompt message (the dsh-llm createUserMessage
 * shape: fresh stable identity, role 'user', exact content blocks and source). */
function createAutomationPromptMessage(
  text: string,
  source: Record<string, unknown>,
): unknown {
  return Object.freeze({
    id: randomUUID(),
    role: 'user' as const,
    content: Object.freeze([{ type: 'text', text }]),
    source,
  })
}

/** Local bound matching `boundSummary` without importing the client module. */
function boundSummaryText(value: string): string | undefined {
  const normalized = value.trim()
  if (normalized === '') return undefined
  return normalized.length <= 2_000 ? normalized : `${normalized.slice(0, 1_999)}…`
}
