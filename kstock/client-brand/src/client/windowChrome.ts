/**
 * 桌面壳适配与上游 UI 修正，两层样式表分开发布：
 *
 * 1. `kstock-ui-fixes`（全平台注入）：上游组件里影响浏览器端的布局修正。
 *    目前一处：文件面板「自动换行」开关复用了 28px 定宽的图标按钮 `.tool`，
 *    四字文本标签被逐字折行成竖排——放开定宽并禁止折行
 *    （`data-file-wrap` 是上游模板上的稳定 data 钩子）。
 *    侧栏品牌名 `.kstock-brand-wordmark` 的样式也在这层（浏览器同样渲染）。
 *
 * 2. `kstock-window-chrome`（仅 Electron）：无框窗口的桌面壳避让。
 *    - macOS hiddenInset：红绿灯叠加在画布左上（trafficLightPosition
 *      {13,18}，灯组占 y 18..30、x 13..65，中心正对 48px 顶栏带）。侧栏
 *      品牌行收成 48px（与会话标题栏同高）并留 84px 左肩；折叠轨（56px
 *      宽）容不下左肩，改为整体把轨内容压到灯组下方；设置弹层是全窗口
 *      面板，导航标题行同样压到灯组下方。品牌行/标题行兼作拖拽条
 *      （行内按钮除外）。
 *    - Windows/Linux titleBarOverlay：内容整体避开系统窗控条
 *      （env 回落 0 时无副作用）。
 *
 * 上游 UI 的类名是 CSS Modules 哈希产物（实测形如 `PBw8SG_logoRow`，前缀式
 * 哈希），用 `[class*="logoRow"]` 属性包含匹配稳定命中本地名；层级覆盖
 * （折叠态、设置标题）用同等特异度的组合选择器并靠注入顺序取胜。
 */

const UI_FIXES_TAG_ID = 'kstock-ui-fixes'
const WINDOW_CHROME_TAG_ID = 'kstock-window-chrome'

/** 全平台生效的上游布局修正 + KStock 品牌名样式。 */
const UI_FIXES_CSS = `
button[data-file-wrap] {
  width: auto;
  min-width: 28px;
  padding: 0 8px;
  white-space: nowrap;
}

.kstock-brand-wordmark {
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: 0;
  white-space: nowrap;
}
`

/** Electron 内注入的窗口壳适配（拖拽条 + 窗控避让）。几何覆盖一律挂
 * `#root` 前缀抬升特异度（ID+类 > 上游任意类组合），不依赖注入顺序。 */
const WINDOW_CHROME_CSS = `
#root [class*="logoRow"],
#root [class*="navTitle"],
#root [class*="header"]:has(> [class*="headerRight"]) {
  -webkit-app-region: drag;
}

#root [class*="logoRow"] :is(button, a, input),
#root [class*="navTitle"] :is(button, a, input),
#root [class*="header"]:has(> [class*="headerRight"]) :is(button, a, input) {
  -webkit-app-region: no-drag;
}

#root {
  padding-top: env(titlebar-area-height, 0px);
  box-sizing: border-box;
}
`

/** macOS 专属：红绿灯左上叠加的避让与顶栏 48px 统一。
 * - 侧栏品牌行收成 48px 并吃掉侧栏列自带的 6px 顶部内边距（margin -6px），
 *   品牌标记中心正对红绿灯中心（y=24）；84px 左肩让开灯组（x 13..65）。
 * - 折叠轨（56px 宽）容不下左肩：轨内容整体压到灯组下方（灯组底 y=30，
 *   折叠轨顶 padding 18 + margin 34 = y 52 起）。
 * - 设置弹层是全窗口面板：导航标题行压到灯组下方（导航顶 padding 22
 *   + margin 26 = y 48 起），标题行兼作拖拽条。 */
const MACOS_TRAFFIC_LIGHTS_CSS = `
#root [class*="logoRow"] {
  height: 48px;
  padding: 0 0 0 84px;
  margin: -6px 0 8px;
}

#root [class*="collapsed"] [class*="logoRow"] {
  height: 36px;
  padding: 0;
  margin: 34px 0 12px;
}

#root [class*="navTitle"] {
  margin-top: 26px;
}
`

function injectStyleTag(tagId: string, css: string): () => void {
  const existing = document.querySelector<HTMLStyleElement>(`style[data-kstock="${tagId}"]`)
  if (existing !== null) return () => existing.remove()
  const tag = document.createElement('style')
  tag.dataset.kstock = tagId
  tag.textContent = css
  document.head.appendChild(tag)
  return () => tag.remove()
}

/** 注入全平台 UI 修正样式表；返回卸用 disposer（幂等：已存在则不再注入）。 */
export function applyUiFixesCss(): () => void {
  if (typeof document === 'undefined') return () => {}
  return injectStyleTag(UI_FIXES_TAG_ID, UI_FIXES_CSS)
}

/**
 * 注入窗口壳适配样式表；返回卸用 disposer（幂等：已存在则不再注入）。
 * 仅 Electron 生效，浏览器直连引擎时不产生任何窗口适配样式；macOS
 * 额外叠加红绿灯避让（Windows/Linux 的窗控条由 overlay env 让位）。
 */
export function applyWindowChromeCss(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (!/Electron/.test(navigator.userAgent)) return () => {}
  const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent)
  return injectStyleTag(WINDOW_CHROME_TAG_ID, WINDOW_CHROME_CSS + (isMac ? MACOS_TRAFFIC_LIGHTS_CSS : ''))
}
