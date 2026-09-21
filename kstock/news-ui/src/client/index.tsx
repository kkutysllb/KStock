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
 * 浏览注册新目录），按任务类型记忆；路由桥为 quant-ui 共享实现
 * buildTaskRouterBridge（workspace 目标经 uiWorkspace.connectWorkspace
 * 落地，会话自动挂进工作区分组，不再「未分组」）。
 */

import { IconNews, buildTaskRouterBridge, injectQuantStyles, type QuantClientContext, type TaskRouterDeps } from '@kstock/quant-ui'
import { bindAgentBridge, bindEmbeddedBrowser, NewsPage } from './page.tsx'

/** 面板键：main slot 与侧栏入口共用。 */
const PANEL_KEY = 'kstock-client-news'

/**
 * sessions + layout + uiWorkspace + workspaces + sidebarRight 的最小结构面
 * （共享桥消费 + 内嵌浏览器打开）。sidebarRight 为引擎 3.0.2+ 右栏导航
 * 服务（ui-sidebar-right 提供），openTab('browser') 命中 ui-sidebar-browser
 * 注册的右栏内嵌浏览器标签。
 */
interface NewsClientContext extends QuantClientContext, TaskRouterDeps {
  sidebarRight?: {
    /** scope=定向到指定会话的右栏（无它则要求当前有挂载会话面，否则抛错）。 */
    openTab(kind: 'browser', options?: { scope?: string; params?: { url?: string } }): void
  }
}

/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
function NavIcon({ size }: { size?: number }) {
  return <IconNews size={size ?? 18} />
}

/**
 * 宿主可嵌性预检（与引擎 ui-chat 补丁同口径）：拒绝 iframe 嵌入的站点
 * 直接走外部浏览器。预检请求失败按可嵌返回（宽松降级，宁可偶尔白屏）。
 */
async function preflightEmbeddable(url: string): Promise<boolean> {
  try {
    const response = await fetch(`/kstock-api/frame-check?url=${encodeURIComponent(url)}`)
    if (!response.ok) return true
    const data = (await response.json()) as { embeddable?: boolean }
    return data.embeddable !== false
  } catch {
    return true
  }
}

/** 必需服务：slot 注册表 + 会话作用域 + 面板切换 + 工作区面 + 右栏导航。 */
export const inject = ['slots', 'sessions', 'layout', 'uiWorkspace', 'workspaces', 'sidebarRight']

/** 客户端插件体。 */
export function apply(ctx: NewsClientContext): void {
  ctx.effect(() => {
    injectQuantStyles()
    bindAgentBridge(buildTaskRouterBridge(ctx))
    // 新闻标题点击 → 右栏内嵌浏览器（与引擎 ui-chat openExternalLink 同姿势）。
    // 两层守卫：①宿主预检 /kstock-api/frame-check（X-Frame-Objects/
    // frame-ancestors 拒绝嵌入的站点直接走外部，不进白屏 iframe）；
    // ②右栏 tab store 挂在会话面上，必须带 scope 定向到当前会话；无选中
    // 会话（右栏本身不存在）或不可嵌时退回原生新标签（壳转系统浏览器）。
    bindEmbeddedBrowser((url) => {
      void (async () => {
        if (await preflightEmbeddable(url)) {
          const sessionId = ctx.uiWorkspace?.selection.getSnapshot().sessionId
          if (sessionId !== undefined) {
            try {
              ctx.sidebarRight?.openTab('browser', { scope: sessionId, params: { url } })
              // 新闻面板占主视图时右栏不在屏幕上：切回该会话视图让浏览器
              // 标签立即可见（与引擎 ui-chat 在会话视图内点击的处境差异）。
              ctx.uiWorkspace?.openSession(sessionId)
              return
            } catch { /* browser 标签缺席等：落到外部打开 */ }
          }
        }
        window.open(url, '_blank', 'noopener,noreferrer')
      })()
    })
    ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_KEY }, NewsPage))
    ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_KEY, order: 140, label: '财经新闻' },
      NavIcon,
    ))
  }, 'kstock-client-news: panel + nav')
}
