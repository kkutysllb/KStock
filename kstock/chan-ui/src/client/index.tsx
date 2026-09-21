/**
 * ${pkg} — KStock 缠论研究客户端插件。
 *
 * 注册 `main` keyed 面板（键 kstock-client-chan）+ `sidebar.panellist`
 * 导航入口。面板直连宿主 `POST /kstock-api/chan-analyze`（秒级引擎），
 * 交互式 K 线缠论图（笔/段/中枢/买卖点叠加）+ 形态/走势/信号摘要 +
 * Agent 深度解读联动（quant-ui 共享路由桥）。
 */

import { IconCandles, buildTaskRouterBridge, injectQuantStyles, type QuantClientContext, type TaskRouterDeps } from '@kstock/quant-ui'
import { ChanPage } from './page.tsx'

/** 面板键：main slot 与侧栏入口共用。 */
const PANEL_KEY = 'kstock-client-chan'

/** sessions + layout + uiWorkspace + workspaces 的最小结构面（共享桥消费）。 */
interface ChanClientContext extends QuantClientContext, TaskRouterDeps {}

/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
function NavIcon({ size }: { size?: number }) {
  return <IconCandles size={size ?? 18} />
}

/** 必需服务：slot 注册表 + 会话作用域 + 面板切换 + 工作区面。 */
export const inject = ['slots', 'sessions', 'layout', 'uiWorkspace', 'workspaces']

/** 客户端插件体。 */
export function apply(ctx: ChanClientContext): void {
  ctx.effect(() => {
    injectQuantStyles()
    ChanPage.bindBridge(buildTaskRouterBridge(ctx))
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_KEY }, ChanPage))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_KEY, order: 150, label: '缠论研究' },
      NavIcon,
    ))
  }, 'kstock-client-chan: panel + nav')
}
