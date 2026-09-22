/** Agent management tools for automations. Registered into an eligible root
 * Agent's scoped tool runtime, so only Agents that received them see them; a
 * run Agent's executor-level guard denies recursive management anyway.
 *
 * Every mutating tool (create/update/run_now/delete) is escalated for human
 * approval by the plugin's `tools/pre-execute` hook (see index.ts); reads and
 * the pause-only update are exempt.
 */

import {
  ValidationError,
  validateCreateInput,
  validateUpdateInput,
} from './domain.ts'
import { ServiceError, type AutomationService } from './service.ts'
import { describeSchedule } from './recurrence.ts'
import type { AutomationSchedule, ModelTarget } from './types.ts'

/** Tools that expand unattended future work or destroy durable state. */
export const MUTATING_TOOLS: ReadonlySet<string> = new Set([
  'automation_create',
  'automation_update',
  'automation_run_now',
  'automation_delete',
])

/** Bound snapshot of the caller identity a tool may bind to. */
export interface ToolCaller {
  readonly cwd?: string | undefined
  readonly sessionId?: string | undefined
}

export function callerFrom(exec: unknown): ToolCaller {
  const agent = (exec as { agent?: { session?: { id?: unknown; header?: { cwd?: unknown; agentPreset?: unknown } } } }).agent
  return {
    sessionId: typeof agent?.session?.id === 'string' ? agent.session.id : undefined,
    cwd: typeof agent?.session?.header?.cwd === 'string' ? agent.session.header.cwd : undefined,
  }
}

/** Bounded definition line for model-facing results. */
export function definitionSummary(definition: {
  readonly id: string
  readonly revision: number
  readonly name: string
  readonly status: string
  readonly schedule: AutomationSchedule
  readonly timeZone: string
  readonly target: { readonly permission: string; readonly modelTarget: ModelTarget | null }
}): string {
  const model = definition.target.modelTarget === null
    ? 'follow-global'
    : `${definition.target.modelTarget.provider}/${definition.target.modelTarget.model}`
      + (definition.target.modelTarget.reasoningEffort === null ? '' : `/${definition.target.modelTarget.reasoningEffort}`)
  return [
    `id=${definition.id}`,
    `rev=${definition.revision}`,
    `name=${definition.name}`,
    `status=${definition.status}`,
    `schedule=${describeSchedule(definition.schedule, definition.timeZone, 'zh')}`,
    `permission=${definition.target.permission}`,
    `model=${model}`,
  ].join(' ')
}

/** Bounded run line for model-facing results. */
export function runSummary(run: {
  readonly id: string
  readonly automationName: string
  readonly status: string
  readonly trigger: string
  readonly scheduledFor: string
  readonly sessionId?: string | undefined
  readonly summary?: string | undefined
  readonly error?: { readonly code: string; readonly message: string } | undefined
  readonly skipReason?: string | undefined
}): string {
  const parts = [
    `id=${run.id}`,
    `automation=${run.automationName}`,
    `status=${run.status}`,
    `trigger=${run.trigger}`,
    `scheduledFor=${run.scheduledFor}`,
  ]
  if (run.sessionId !== undefined) parts.push(`session=${run.sessionId}`)
  if (run.summary !== undefined) parts.push(`summary=${run.summary.slice(0, 400)}`)
  if (run.error !== undefined) parts.push(`error=${run.error.code}: ${run.error.message.slice(0, 300)}`)
  if (run.skipReason !== undefined) parts.push(`skip=${run.skipReason}`)
  return parts.join(' ')
}

const jsonRender = (_args: unknown, value: unknown) => [
  { type: 'text' as const, text: JSON.stringify(value, null, 2) },
]

export interface AutomationToolDef {
  readonly name: string
  readonly description: string
  readonly parameters: Record<string, unknown>
  readonly output: {
    readonly schema: Record<string, unknown>
    render(args: unknown, value: unknown): readonly { readonly type: 'text'; readonly text: string }[]
  }
  readonly timeoutMs: number
  execute(args: unknown, exec: unknown): Promise<unknown>
}

/** The six management verbs as tool definitions. */
export function automationToolDefs(service: AutomationService): readonly AutomationToolDef[] {
  const scheduleParameters: Record<string, unknown> = {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['once', 'interval', 'daily', 'weekly'] },
      at: { type: 'string', description: 'once 专用：ISO 时刻，如 2026-09-20T09:00:00+08:00' },
      everyMinutes: { type: 'number', description: 'interval 专用：整数 ≥5' },
      time: { type: 'string', description: 'daily/weekly 专用：HH:mm（任务时区的本地时间）' },
      weekdays: { type: 'array', items: { type: 'number' }, description: 'weekly 专用：1..7，周一为 1' },
    },
  }
  return [
    {
      name: 'automation_create',
      description: '创建定时任务：为调用者所在工作区创建一条独立执行规则。每次运行在全新根 Agent 会话内执行，不继承当前对话上下文。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '任务名称（≤120 字）' },
          prompt: { type: 'string', description: '自包含任务提示词：目标、要检查的证据、允许的改动、验收与停止条件' },
          schedule: scheduleParameters,
          timeZone: { type: 'string', description: 'daily/weekly 必填：IANA 时区，如 Asia/Shanghai' },
          permission: { type: 'string', enum: ['read-only', 'workspace-write'], description: '无人值守权限边界，缺省 read-only' },
          modelTarget: {
            type: 'object',
            properties: {
              provider: { type: 'string' },
              model: { type: 'string' },
              reasoningEffort: { type: ['string', 'null'] },
            },
            description: '缺省（不传）跟随全局模型选择',
          },
        },
      },
      output: { schema: { type: 'object' }, render: jsonRender },
      timeoutMs: 60_000,
      execute: async (args, exec) => {
        const caller = callerFrom(exec)
        try {
          if (caller.cwd === undefined) throw new ToolRejection('no-session', CALLER_CWD_MESSAGE)
          const workspace = await service.resolveWorkspace(caller.cwd)
          const record = args as Record<string, unknown>
          const definition = await service.create(validateCreateInput({
            name: record.name,
            prompt: record.prompt,
            schedule: record.schedule,
            timeZone: record.timeZone ?? '',
            workspaceId: workspace.id,
            cwd: workspace.path,
            agentPreset: typeof record['agentPreset'] === 'string' && record['agentPreset'].trim() !== ''
              ? record['agentPreset'].trim().slice(0, 200)
              : service.agentPresetForSession(caller.sessionId) ?? 'standard',
            permission: record.permission ?? 'read-only',
            modelTarget: modelTargetOf(record.modelTarget),
          }))
          return {
            ok: true,
            value: {
              id: definition.id,
              revision: definition.revision,
              name: definition.name,
              status: definition.status,
              schedule: describeSchedule(definition.schedule, definition.timeZone, 'zh'),
              permission: definition.target.permission,
              nextHint: '可用 automation_run_now 在依赖调度前先验证一次',
            },
          }
        } catch (error) {
          return toolEnvelope(error)
        }
      },
    },
    {
      name: 'automation_list',
      description: '列出调用者所在工作区的全部定时任务（含下次运行时间与最近一次结果摘要）。',
      parameters: { type: 'object', properties: {} },
      output: { schema: { type: 'object' }, render: jsonRender },
      timeoutMs: 15_000,
      execute: async (_args, exec) => {
        const caller = callerFrom(exec)
        try {
          const cwd = requireCallerCwd(caller)
          const views = service.automationsForCwd(cwd)
          return {
            ok: true,
            value: {
              workspace: cwd,
              automations: views.map(view => ({
                ...view,
                prompt: view.prompt.slice(0, 800),
              })),
            },
          }
        } catch (error) {
          return toolEnvelope(error)
        }
      },
    },
    {
      name: 'automation_update',
      description: '更新定时任务：name/prompt/schedule/timeZone/status/permission/modelTarget 部分更新，修订号递增；仅 status=paused 的单独暂停豁免人工审批。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '任务 id' },
          name: { type: 'string' },
          prompt: { type: 'string' },
          schedule: scheduleParameters,
          timeZone: { type: 'string' },
          status: { type: 'string', enum: ['active', 'paused'] },
          permission: { type: 'string', enum: ['read-only', 'workspace-write'] },
          modelTarget: {
            type: 'object',
            properties: {
              provider: { type: 'string' },
              model: { type: 'string' },
              reasoningEffort: { type: ['string', 'null'] },
            },
            description: 'null 表示恢复跟随全局选择',
          },
        },
      },
      output: { schema: { type: 'object' }, render: jsonRender },
      timeoutMs: 60_000,
      execute: async (args, exec) => {
        try {
          const caller = callerFrom(exec)
          const cwd = requireCallerCwd(caller)
          const record = args as Record<string, unknown>
          const id = requireString(record.id, 'id', 120)
          assertOwned(service, caller, id, cwd)
          const next = await service.update(id, validateUpdateInput(record))
          return { ok: true, value: { automation: definitionSummary(next) } }
        } catch (error) {
          return toolEnvelope(error)
        }
      },
    },
    {
      name: 'automation_run_now',
      description: '立即执行一次：以相同边界排队一次手动运行，马上返回 runId（结果稍后用 automation_runs 查看）。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
      output: { schema: { type: 'object' }, render: jsonRender },
      timeoutMs: 30_000,
      execute: async (args, exec) => {
        try {
          const caller = callerFrom(exec)
          const cwd = requireCallerCwd(caller)
          const record = args as Record<string, unknown>
          const id = requireString(record.id, 'id', 120)
          assertOwned(service, caller, id, cwd)
          const run = await service.runNow(id)
          return { ok: true, value: { runId: run.id, status: run.status, scheduledFor: run.scheduledFor } }
        } catch (error) {
          return toolEnvelope(error)
        }
      },
    },
    {
      name: 'automation_runs',
      description: '读取运行历史：状态、时间、结果摘要、错误与结果会话 id。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '任务 id；缺省列出工作区内全部任务的最近运行' },
          limit: { type: 'number', description: '1..50，缺省 20' },
        },
      },
      output: { schema: { type: 'object' }, render: jsonRender },
      timeoutMs: 15_000,
      execute: async (args, exec) => {
        try {
          const caller = callerFrom(exec)
          const cwd = requireCallerCwd(caller)
          const record = args as Record<string, unknown>
          const limit = typeof record.limit === 'number' && Number.isSafeInteger(record.limit)
            ? Math.min(100, Math.max(1, record.limit))
            : 20
          if (typeof record.id === 'string' && record.id.trim() !== '') {
            const id = record.id.trim()
            assertOwned(service, caller, id, cwd)
            return { ok: true, value: { runs: service.listRuns(id, limit).map(runSummary) } }
          }
          const views = service.automationsForCwd(cwd)
          return {
            ok: true,
            value: {
              runs: views.flatMap(view =>
                service.listRuns(view.id, Math.min(limit, 10)).map(runSummary)),
            },
          }
        } catch (error) {
          return toolEnvelope(error)
        }
      },
    },
    {
      name: 'automation_delete',
      description: '删除定时任务定义（运行历史保留，但调度不可恢复）。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
      output: { schema: { type: 'object' }, render: jsonRender },
      timeoutMs: 15_000,
      execute: async (args, exec) => {
        try {
          const caller = callerFrom(exec)
          const cwd = requireCallerCwd(caller)
          const record = args as Record<string, unknown>
          const id = requireString(record.id, 'id', 120)
          assertOwned(service, caller, id, cwd)
          await service.mutate(id, 'delete')
          return { ok: true, value: { id, deleted: true } }
        } catch (error) {
          return toolEnvelope(error)
        }
      },
    },
  ]
}

// ── binding + envelopes ─────────────────────────────────────────────────────

const CALLER_CWD_MESSAGE = '无法定位调用者工作区（需要活跃会话）(the caller workspace is unresolvable)'

class ToolRejection extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ToolRejection'
  }
}

export type ToolEnvelope =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

function toolEnvelope(error: unknown): ToolEnvelope {
  if (error instanceof ToolRejection) return { ok: false, error: { code: error.code, message: error.message } }
  if (error instanceof ValidationError) return { ok: false, error: { code: 'invalid', message: error.message } }
  if (error instanceof ServiceError) return { ok: false, error: { code: error.code, message: error.message } }
  return { ok: false, error: { code: 'internal', message: error instanceof Error ? error.message : String(error) } }
}

function requireCallerCwd(caller: ToolCaller): string {
  if (caller.cwd === undefined) throw new ToolRejection('no-session', CALLER_CWD_MESSAGE)
  return caller.cwd
}

/** Definitions are workspace-bound: callers cannot touch another cwd's rules. */
function assertOwned(service: AutomationService, caller: ToolCaller, id: string, cwd: string): void {
  const definition = service.definitionOf(id)
  if (definition === undefined) throw new ToolRejection('not-found', `未找到任务 ${id} (unknown automation)`)
  if (definition.target.cwd !== cwd) {
    throw new ToolRejection('forbidden', '任务绑定在其他工作区 (the automation is bound to another workspace)')
  }
}

function requireString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} must be a non-empty string`, field)
  }
  const trimmed = value.trim()
  if (trimmed.length > max) throw new ValidationError(`${field} exceeds ${max} chars`, field)
  return trimmed
}

/** Model target: absent/null → follow global; object → pinned triple. */
function modelTargetOf(raw: unknown): ModelTarget | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object') throw new ValidationError('modelTarget must be an object', 'modelTarget')
  const record = raw as Record<string, unknown>
  const provider = requireString(record.provider, 'modelTarget.provider', 200)
  const model = requireString(record.model, 'modelTarget.model', 200)
  const effort = record.reasoningEffort
  return {
    provider,
    model,
    reasoningEffort: effort === undefined || effort === null ? null : requireString(effort, 'modelTarget.reasoningEffort', 100),
  }
}
