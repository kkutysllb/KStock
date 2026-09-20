/**
 * ${pkg} — KStock 量化库客户端插件。
 *
 * 注册 `main` keyed 面板（键 kstock-quant-selections）+ `sidebar.panellist` 导航入口
 * （同 id，侧栏自动接线 ctx.layout.selectPanel）；ksq 样式经
 * @kstock/quant-ui 幂等注入（四个量化库插件共用一份）。
 *
 * 研究联动（P2 命中清单）：注入 `sessions` + `layout`——命中股「解读」按钮
 * 经 sessions 作用域的 conversation.send() 把带方案上下文的提示词送进当前
 * 会话，随后 layout.selectPanel(null) 切回对话页（与 @kstock/client-news
 * 同款桥接形态）。
 */

import { IconTarget } from '@kstock/quant-ui'
import { injectQuantStyles, type QuantClientContext } from '@kstock/quant-ui'
import { bindAgentBridge } from './agent.ts'
import { SelectionsPage } from './page.tsx'

/** 面板键：main slot 与侧栏入口共用。 */
const PANEL_KEY = 'kstock-quant-selections'

/** sessions 服务的最小结构面（当前会话解析 + 建会话 + 作用域）。 */
interface SessionsFace {
  list: { getSnapshot(): { current?: string } }
  create(opts?: { workspaceId?: string; cwd?: string; sessionId?: string }): Promise<string>
  open(id: string): void
  scope(id: string): { get(name: string): unknown } | undefined
}

/** sessions + layout 的最小结构面（运行时按上游契约调用）。 */
interface SelectionsClientContext extends QuantClientContext {
  sessions?: SessionsFace
  layout?: { selectPanel(panelId: string | null): void }
}

/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
function NavIcon({ size }: { size?: number }) {
  return <IconTarget size={size ?? 18} />
}

/** 必需服务：slot 注册表 + 会话作用域 + 面板切换。 */
export const inject = ['slots', 'sessions', 'layout']

/** 客户端插件体。 */
export function apply(ctx: SelectionsClientContext): void {
  ctx.effect(() => {
    injectQuantStyles()
    bindAgentBridge({
      // conversation.send 需要会话作用域（上游契约：未经 scope 的
      // conversation 服务没有会话归属）——取当前会话，无则建一个并
      // 置为当前，再经 scope(id).conversation 发送。
      send: async (text: string) => {
        const sessions = ctx.sessions
        if (sessions === undefined) throw new Error('会话服务不可用')
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
      // 上游 openSession 同款：selectPanel(null) 回到对话主面板。
      gotoConversation: () => ctx.layout?.selectPanel(null),
    })
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_KEY }, SelectionsPage))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_KEY, order: 120, label: '选股库' },
      NavIcon,
    ))
  }, 'kstock-quant-selections: panel + nav')
}
