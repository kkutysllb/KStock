/** Cordis Host plugin for durable standalone DSH automations (麒麟定时任务).
 *
 * Owns: durable definitions + run history (storage domain), the dispatch
 * clock, the fresh-Agent executor, the Web RPC channel, agent-scoped
 * management tools, and the capability announcement section. Does not patch
 * DSH core; every integration rides published services and events.
 *
 * Deployment note (KCoder packaged harness): no `@deepseek-ai/*` runtime
 * imports — services arrive via the `inject` names, config arrives as the
 * plain patch-row object, and the service factory clamps it.
 */

import type { Context } from '@deepseek-ai/cordis'
import { registerAutomationRpc } from './rpc.ts'
import { AutomationService } from './service.ts'
import { automationToolDefs, callerFrom, MUTATING_TOOLS } from './tools.ts'
import type { AutomationService as Service } from './service.ts'

export const name = 'dsh-kylin-automation'

export const inject = [
  'storageDomain',
  'agents',
  'workspaceRegistry',
  'agentDefaultModel',
  'agentPresets',
  'sessionTitle',
  'connection',
  'webServer',
  'systemPrompt',
  'sessions',
] as const

/** Plugin configuration (patch-row `config` values are read defensively). */
export interface Config {
  readonly maxConcurrentRuns?: number
  readonly runTimeoutMinutes?: number
  readonly misfireGraceMinutes?: number
  readonly historyLimit?: number
}

/** Executor-minted run Sessions are recognizable by id prefix; management
 * tools are never mounted onto them (and their executor guard denies the
 * same verbs anyway — defense in depth). */
function isAutomationRunSession(sessionId: string): boolean {
  return sessionId.startsWith('kauto-session-')
}

/** A pause-only update does not expand unattended work; everything else does. */
export function needsHumanApproval(
  exec: { readonly name: string; readonly arguments?: unknown; readonly signal: AbortSignal },
  mountedAgent: boolean,
): boolean {
  if (!mountedAgent || exec.signal.aborted || !MUTATING_TOOLS.has(exec.name)) return false
  if (exec.name !== 'automation_update') return true
  const args = typeof exec.arguments === 'object' && exec.arguments !== null
    ? exec.arguments as Record<string, unknown>
    : {}
  return !(args['status'] === 'paused' && Object.keys(args).every(key => key === 'id' || key === 'status'))
}

export function humanApprovalReason(toolName: string): string {
  if (toolName === 'automation_delete') {
    return '此操作会永久删除定时任务定义（运行历史保留但调度不可恢复）。'
  }
  if (toolName === 'automation_create') {
    return '该操作将创建无人值守的未来执行任务。请确认任务提示词、时间计划、工作区与权限边界。'
  }
  return '该操作将创建或扩大无人值守的未来执行范围，请确认任务计划与权限边界。'
}

/** Mount one host-wide authority and agent-scoped management tools. */
export async function apply(ctx: Context, rawConfig: Config): Promise<void> {
  await ctx.effect(async () => {
    const service: Service = await AutomationService.open(ctx, rawConfig)
    // 时钟 + 崩溃恢复必须显式启动：不调用则 requestTick 因 alive=false
    // 直接返回，定时 occurrence 永不派发（仅 automation_run_now 手动
    // 路径可用）。
    service.start()
    const agentTools = new Map<string, () => void>()
    const owned: Array<() => void> = []

    // Capability announcement: one bounded prompt section so agents discover
    // the workflow without reading plugin internals.
    owned.push(ctx.systemPrompt.section({
      name: `plugin:${name}`,
      order: 206,
      text: ANNOUNCEMENT,
    }))

    const mountTools = (agent: unknown): void => {
      const scoped = agent as {
        id?: unknown
        session?: { id?: unknown }
        ctx?: import('@deepseek-ai/cordis').Context
      }
      const agentId = typeof scoped?.id === 'string' ? scoped.id : undefined
      const sessionId = typeof scoped?.session?.id === 'string' ? scoped.session.id : undefined
      if (agentId === undefined || sessionId === undefined || scoped.ctx === undefined) return
      if (isAutomationRunSession(sessionId)) return
      if (!ctx.agents.roots().some(root => root.id === agentId)) return
      if (agentTools.has(agentId)) return
      // Scoped registrations ride the agent scope fiber: agent teardown removes
      // them in order; the recorded disposer is the plugin's safety net.
      const registered = scoped.ctx.effect(() => {
        const removers = automationToolDefs(service).map(def => scoped.ctx!.tools.register(def))
        return () => {
          for (const remove of [...removers].reverse()) { void remove() }
        }
      }, 'dsh-kylin-automation: management tools')
      agentTools.set(agentId, registered)
    }

    for (const root of ctx.agents.roots()) mountTools(root)
    owned.push(ctx.on('agent/created', ({ agent }: { agent?: unknown }) => { mountTools(agent) }))
    owned.push(ctx.on('agent/disposed', ({ agent }: { agent?: unknown }) => {
      const agentId = (agent as { id?: string } | undefined)?.id
      if (typeof agentId === 'string') agentTools.delete(agentId)
    }))
    owned.push(ctx.on('tools/pre-execute', async (exec: unknown, next: () => Promise<{ kind: string }>) => {
      const downstream = await next()
      if (downstream.kind !== 'allow') return downstream
      const caller = callerFrom(exec)
      const mounted = caller.sessionId !== undefined
        && !isAutomationRunSession(caller.sessionId)
        && agentTools.has(caller.sessionId)
      const wantsApproval = needsHumanApproval(
        exec as { name: string; arguments?: unknown; signal: AbortSignal },
        mounted,
      )
      if (!wantsApproval) return downstream
      return {
        kind: 'ask' as const,
        reason: humanApprovalReason((exec as { name: string }).name),
      }
    }))

    const removeRpc = registerAutomationRpc(ctx, service)

    return async () => {
      for (const dispose of [...agentTools.values()].reverse()) {
        try { dispose() } catch (error: unknown) {
          ctx.logger.warn(`dsh-kylin-automation: tool teardown failed: ${String(error)}`)
        }
      }
      agentTools.clear()
      for (const dispose of [...owned].reverse()) {
        try { dispose() } catch (error: unknown) {
          ctx.logger.warn(`dsh-kylin-automation: listener teardown failed: ${String(error)}`)
        }
      }
      await removeRpc()
      await service.dispose()
    }
  }, 'dsh-kylin-automation: service')
}

const ANNOUNCEMENT = `本机已安装 dsh-kylin-automation 插件（定时任务）。把"完整可自足"的编码任务按时间计划投递到全新根 Agent 会话独立执行，运行历史持久可审计。六个工具：automation_create（创建规则：一次性/固定间隔≥5min/每天/每周，daily/weekly 需 IANA 时区，权限 read-only 或 workspace-write，缺省跟随全局模型，可传 modelTarget 钉住 provider/model/effort）、automation_list（本工作区任务清单）、automation_update（部分更新；仅 status=paused 单独暂停豁免人工审批）、automation_run_now（立即跑一次，先验证再依赖调度）、automation_runs（运行历史：状态/摘要/错误/结果会话 id）、automation_delete（删除定义，历史保留）。注意：定时任务不继承当前对话；任务提示词必须自包含（目标、证据、允许改动、验收与停止条件）。管理操作会产生未来自动执行，用户会收到人工审批确认。Web 侧边栏「定时任务」入口提供独立管理页面。`
