/**
 * ${pkg} — KStock 财经新闻客户端插件。
 *
 * 注册 `main` keyed 面板（键 kstock-client-news）+ `sidebar.panellist`
 * 导航入口（同 id，侧栏自动接线 ctx.layout.selectPanel）。与四个量化库
 * 插件同款注册形态（对照 @kstock/quant-factors）；ksq 样式经
 * @kstock/quant-ui 幂等注入。
 *
 * 数据走 @kstock/quant 宿主三路：`GET /kstock-api/workspace-news`
 * （东方财富主源 + 央视备源，60 秒缓存，带标的识别标注）、
 * `news-archive`（历史检索）、`news-stats`（热词榜 + 24h 频率）。
 *
 * 研究联动（§26-10 目标选择菜单）：标的徽章与「解读」按钮先弹
 * TaskTargetMenu 让用户选任务归属（跟随当前会话 / 已注册子工作区 /
 * 浏览注册新目录），按任务类型记忆；工作区目标经 uiWorkspace.
 * connectWorkspace 落地（会话自动挂进工作区分组，不再「未分组」）。
 */

import { IconNews, injectQuantStyles, type QuantClientContext, type TaskRouterBridge, type TaskTarget } from '@kstock/quant-ui'
import { bindAgentBridge, NewsPage } from './page.tsx'

/** 面板键：main slot 与侧栏入口共用。 */
const PANEL_KEY = 'kstock-client-news'

/** sessions + layout + uiWorkspace + workspaces 的最小结构面。 */
interface NewsClientContext extends QuantClientContext {
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
  return <IconNews size={size ?? 18} />
}

/** 必需服务：slot 注册表 + 会话作用域 + 面板切换 + 工作区面。 */
export const inject = ['slots', 'sessions', 'layout', 'uiWorkspace', 'workspaces']

/** 客户端插件体。 */
export function apply(ctx: NewsClientContext): void {
  ctx.effect(() => {
    injectQuantStyles()
    bindAgentBridge({
      // §26-10 目标选择菜单的路由桥：current=当前会话语义；
      // workspace=connectWorkspace（复用/新建 blank 会话并挂进该工作区
      // 分组——修复裸 create({cwd}) 的「未分组」与产物散落）。
      send: async (target: TaskTarget, text: string): Promise<void> => {
        const sessions = ctx.sessions
        if (sessions === undefined) throw new Error('会话服务不可用')
        if (target.kind === 'workspace') {
          const uiWorkspace = ctx.uiWorkspace
          if (uiWorkspace === undefined) throw new Error('工作区服务不可用')
          const sessionId = await uiWorkspace.connectWorkspace(target.workspaceId)
          sessions.open(sessionId)
          const scoped = sessions.scope(sessionId)
          const conversation = scoped?.get('conversation') as
            | { send(prompt: string): Promise<void> }
            | undefined
          if (conversation === undefined) throw new Error('会话作用域不可用（conversation 服务缺席）')
          await conversation.send(text)
          return
        }
        let id = sessions.list.getSnapshot().current
        if (id === undefined) {
          id = await sessions.create()
          sessions.open(id)
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
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_KEY }, NewsPage))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_KEY, order: 140, label: '财经新闻' },
      NavIcon,
    ))
  }, 'kstock-client-news: panel + nav')
}
