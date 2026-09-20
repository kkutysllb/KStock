/**
 * ${pkg} — KStock 财经新闻客户端插件。
 *
 * 注册 `main` keyed 面板（键 kstock-client-news）+ `sidebar.panellist`
 * 导航入口（同 id，侧栏自动接线 ctx.layout.selectPanel）。与四个量化库
 * 插件同款注册形态（对照 @kstock/quant-factors）；ksq 样式经
 * @kstock/quant-ui 幂等注入。数据走 @kstock/quant 宿主的
 * `GET /kstock-api/workspace-news`（东方财富主源 + 央视备源，60 秒缓存）。
 */

import { IconNews, injectQuantStyles, type QuantClientContext } from '@kstock/quant-ui'
import { NewsPage } from './page.tsx'

/** 面板键：main slot 与侧栏入口共用。 */
const PANEL_KEY = 'kstock-client-news'

/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
function NavIcon({ size }: { size?: number }) {
  return <IconNews size={size ?? 18} />
}

/** 必需服务：slot 注册表。 */
export const inject = ['slots']

/** 客户端插件体。 */
export function apply(ctx: QuantClientContext): void {
  ctx.effect(() => {
    injectQuantStyles()
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_KEY }, NewsPage))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_KEY, order: 140, label: '财经新闻' },
      NavIcon,
    ))
  }, 'kstock-client-news: panel + nav')
}
