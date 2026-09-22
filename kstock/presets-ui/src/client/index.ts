/**
 * `@kstock/client-presets` — KStock 角色 preset 选择器（浏览器半端）。
 *
 * 上游 ui-agent-preset 的选择器选项 = preset 名册全量（无隐藏机制）。
 * KStock 的产品口径：standard 是隐形默认基座（不进选择器），选择器只列
 * 6 个投研角色。因此禁用上游选择器行（见 @kstock/web cordis.patch.yml），
 * 由本插件在同一个 hero 槽位提供过滤版选择器。
 *
 * 语义与上游 seat 相同：选择只在会话启动前生效（host 拒绝对已启动会话
 * 换预设）；blank 会话出现即应用暂存选择。
 * @module @kstock/client-presets
 */

import type { Context as ClientContext } from '@qilin/kylin'
// Type-only：拉入 hero 槽位与 remote/session 服务面的 SlotMap/Context 合并。
import type {} from '@qilin/client-ui-conversation/client'
import type {} from '@qilin/api-remotes/client'
import type {} from '@qilin/api-session-controller/client'
import { KStockPresetsSeat } from './seat.tsx'
import { PresetsSeatController, KSTOCK_ROLE_PRESET_IDS } from './seat-store.ts'

/** 必需服务：槽位注册表。 */
export const inject = ['slots'] as const

/** ui-workspace 服务的最小选择面（会话视图选择的权威源）。 */
interface SelectionFace {
  readonly uiWorkspace: {
    readonly selection: {
      getSnapshot(): { sessionId?: string }
      subscribe(listener: () => void): () => void
    }
  }
}

/**
 * 挂载角色选择器：注册进新会话 hero 槽位（与上游 seat 同名槽位，上游行
 * 已在 patch 层禁用，不会重复渲染）。
 * 语义与上游 seat 相同：选择只在会话启动前生效（host 拒绝对已启动会话
 * 换预设）；blank 会话出现即应用暂存选择。
 * @param ctx - 浏览器插件根上下文。
 */
export function apply(ctx: ClientContext): void {
  ctx.inject(['slots', 'conversation', 'sessions', 'remote', 'remote.agentPresets', 'uiWorkspace'], (scope: ClientContext) => {
    const workspace = scope as typeof scope & SelectionFace
    const controller = new PresetsSeatController({
      sessions: scope.sessions,
      remote: scope.remote,
      selection: workspace.uiWorkspace.selection,
    })

    scope.effect(() => {
      // blank 会话可能在选择之前或之后出现（上游 seat 同款双触发）；
      // 会话视图选择变化（新会话成为当前）同样触发应用。
      const stopList = scope.sessions.list.subscribe(() => { void controller.apply() })
      const stopSelection = workspace.uiWorkspace.selection.subscribe(() => { void controller.apply() })
      void controller.load()
      return () => {
        stopList()
        stopSelection()
        controller.dispose()
      }
    }, 'kstock-presets: seat wiring')

    const chip = scope.slots.register({
      name: 'conversation.hero.agentPreset',
      id: 'kstock-roles',
      inject: () => ({
        hooks: { presetsSeat: controller.store },
        load: () => controller.load(),
        select: (id: string) => controller.select(id),
      }),
    }, KStockPresetsSeat)
    return () => { chip() }
  })
}

export { KSTOCK_ROLE_PRESET_IDS }
