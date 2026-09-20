/**
 * ${pkg} — KStock 量化库客户端插件。
 *
 * 注册 `main` keyed 面板（键 kstock-quant-selections）+ `sidebar.panellist` 导航入口
 * （同 id，侧栏自动接线 ctx.layout.selectPanel）；ksq 样式经
 * @kstock/quant-ui 幂等注入（四个量化库插件共用一份）。
 *
 * 研究联动（P2 + §26-10 目标选择菜单）：命中股「解读」按钮先弹
 * TaskTargetMenu 让用户选任务归属（跟随当前会话 / 已注册子工作区 /
 * 浏览注册新目录），按 pick 类型记忆；工作区目标经 uiWorkspace.
 * connectWorkspace 落地（会话挂进工作区分组，不再「未分组」）。
 */

import { IconTarget } from '@kstock/quant-ui'
import { injectQuantStyles, type QuantClientContext, type TaskRouterBridge, type TaskTarget } from '@kstock/quant-ui'
import { bindAgentBridge } from './agent.ts'
import { SelectionsPage } from './page.tsx'

/** 面板键：main slot 与侧栏入口共用。 */
const PANEL_KEY = 'kstock-quant-selections'

/** sessions + layout + uiWorkspace + workspaces 的最小结构面。 */
interface SelectionsClientContext extends QuantClientContext {
  sessions?: import('@kstock/quant-ui').SessionsFace
  layout?: { selectPanel(panelId: string | null): void }
  uiWorkspace?: {
    pickDirectory(): Promise<string | null>
    connectWorkspace(workspaceId: string): Promise<string>
  }
  workspaces?: {
    create(input: { path: string }): Promise<{ workspaceId: string; path: string }>
  }
}

/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
function NavIcon({ size }: { size?: number }) {
  return <IconTarget size={size ?? 18} />
}

/** 必需服务：slot 注册表 + 会话作用域 + 面板切换 + 工作区面。 */
export const inject = ['slots', 'sessions', 'layout', 'uiWorkspace', 'workspaces']

/** 客户端插件体。 */
export function apply(ctx: SelectionsClientContext): void {
  ctx.effect(() => {
    injectQuantStyles()
    bindAgentBridge({
      // §26-10 目标选择菜单的路由桥：current=当前会话语义；
      // workspace=connectWorkspace（复用/新建 blank 会话并挂进该工作区
      // 分组——修复裸 create({cwd}) 的「未分组」与产物散落）。
      send: async (target: TaskTarget, text: string): Promise<void> => {
        const sessions = ctx.sessions
        if (sessions === undefined) throw new Error('会话服务不可用')
        let id: string | undefined
        if (target.kind === 'workspace') {
          const uiWorkspace = ctx.uiWorkspace
          if (uiWorkspace === undefined) throw new Error('工作区服务不可用')
          id = await uiWorkspace.connectWorkspace(target.workspaceId)
          sessions.open(id)
        } else {
          id = sessions.list.getSnapshot().current
          if (id === undefined) {
            id = await sessions.create()
            sessions.open(id)
          }
        }
        const scoped = sessions.scope(id)
        const conversation = scoped?.get('conversation') as
          | { send(prompt: string): Promise<void> }
          | undefined
        if (conversation === undefined) throw new Error('会话作用域不可用（conversation 服务缺席）')
        await conversation.send(text)
      },
      pickDirectory: () => {
        if (ctx.uiWorkspace === undefined) return Promise.reject(new Error('工作区服务不可用'))
        return ctx.uiWorkspace.pickDirectory()
      },
      registerWorkspace: async (path: string) => {
        if (ctx.workspaces === undefined) throw new Error('工作区注册服务不可用')
        return await ctx.workspaces.create({ path })
      },
      // 上游 openSession 同款：selectPanel(null) 回到对话主面板。
      gotoConversation: () => ctx.layout?.selectPanel(null),
    } satisfies TaskRouterBridge)
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_KEY }, SelectionsPage))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_KEY, order: 120, label: '选股库' },
      NavIcon,
    ))
  }, 'kstock-quant-selections: panel + nav')
}
