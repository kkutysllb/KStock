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
 * 研究联动：注入 `conversation` 服务——标的徽章点击与「让 Agent 解读」
 * 按钮经 `conversation.send()` 把结构化提示词送进当前会话（官方排队
 * 回合通道），随后 `layout.selectPanel('conversation')` 切回对话页。
 */

import { IconNews, injectQuantStyles, sendRouted, type QuantClientContext } from '@kstock/quant-ui'
import { bindAgentBridge, NewsPage } from './page.tsx'

/** 面板键：main slot 与侧栏入口共用。 */
const PANEL_KEY = 'kstock-client-news'

/** sessions + layout 的最小结构面（运行时按上游契约调用）。 */
interface NewsClientContext extends QuantClientContext {
  sessions?: import('@kstock/quant-ui').SessionsFace
  layout?: { selectPanel(panelId: string | null): void }
}

/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
function NavIcon({ size }: { size?: number }) {
  return <IconNews size={size ?? 18} />
}

/** 必需服务：slot 注册表 + 会话作用域 + 面板切换。 */
export const inject = ['slots', 'sessions', 'layout']

/** 客户端插件体。 */
export function apply(ctx: NewsClientContext): void {
  ctx.effect(() => {
    injectQuantStyles()
    bindAgentBridge({
      // 工作区智能路由（§26-9）：量化工作区已配置且当前会话不在其中时，
      // 自动路由到目标工作区会话（复用 blank/最近会话，冷启动 create({cwd})）；
      // 未配置回退「跟当前会话」语义。详见 @kstock/quant-ui agent-route。
      send: (text: string) => sendRouted(ctx.sessions, text),
      // 上游 openSession 同款：selectPanel(null) 回到对话主面板。
      gotoConversation: () => ctx.layout?.selectPanel(null),
    })
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_KEY }, NewsPage))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_KEY, order: 140, label: '财经新闻' },
      NavIcon,
    ))
  }, 'kstock-client-news: panel + nav')
}
