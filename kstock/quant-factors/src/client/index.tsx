/**
 * ${pkg} — KStock 量化库客户端插件。
 *
 * 注册 `main` keyed 面板（键 kstock-quant-factors）+ `sidebar.panellist` 导航入口
 * （同 id，侧栏自动接线 ctx.layout.selectPanel）；ksq 样式经
 * @kstock/quant-ui 幂等注入（四个量化库插件共用一份）。
 *
 * 研究联动（§27-F2）：检验 run「解读」按钮先弹 TaskTargetMenu 选任务
 * 归属（跟随当前会话/已注册子工作区/浏览注册新目录），按 factor 类型
 * 记忆；路由桥为 quant-ui 共享实现 buildTaskRouterBridge。
 */

import { IconFlask, buildTaskRouterBridge, injectQuantStyles, type QuantClientContext, type TaskRouterDeps } from '@kstock/quant-ui'
import { bindAgentBridge } from './agent.ts'
import { FactorsPage } from './page.tsx'

/** 面板键：main slot 与侧栏入口共用。 */
const PANEL_KEY = 'kstock-quant-factors'

/** sessions + layout + uiWorkspace + workspaces 的最小结构面（共享桥消费）。 */
interface FactorsClientContext extends QuantClientContext, TaskRouterDeps {}

/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
function NavIcon({ size }: { size?: number }) {
  return <IconFlask size={size ?? 18} />
}

/** 必需服务：slot 注册表 + 会话作用域 + 面板切换 + 工作区面。 */
export const inject = ['slots', 'sessions', 'layout', 'uiWorkspace', 'workspaces']

/** 客户端插件体。 */
export function apply(ctx: FactorsClientContext): void {
  ctx.effect(() => {
    injectQuantStyles()
    bindAgentBridge(buildTaskRouterBridge(ctx))
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_KEY }, FactorsPage))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_KEY, order: 110, label: '因子库' },
      NavIcon,
    ))
  }, 'kstock-quant-factors: panel + nav')
}
