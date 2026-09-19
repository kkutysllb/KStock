/**
 * ${pkg} — KStock 量化库客户端插件。
 *
 * 注册 `main` keyed 面板（键 kstock-quant-selections）+ `sidebar.panellist` 导航入口
 * （同 id，侧栏自动接线 ctx.layout.selectPanel）；ksq 样式经
 * @kstock/quant-ui 幂等注入（四个量化库插件共用一份）。
 */

import { IconTarget } from '@kstock/quant-ui'
import { injectQuantStyles, type QuantClientContext } from '@kstock/quant-ui'
import { SelectionsPage } from './page.tsx'

/** 面板键：main slot 与侧栏入口共用。 */
const PANEL_KEY = 'kstock-quant-selections'

/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
function NavIcon({ size }: { size?: number }) {
  return <IconTarget size={size ?? 18} />
}

/** 必需服务：slot 注册表。 */
export const inject = ['slots']

/** 客户端插件体。 */
export function apply(ctx: QuantClientContext): void {
  ctx.effect(() => {
    injectQuantStyles()
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_KEY }, SelectionsPage))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_KEY, order: 120, label: '选股库' },
      NavIcon,
    ))
  }, 'kstock-quant-selections: panel + nav')
}
