/**
 * 无框窗口的桌面壳适配（2.0 窗口回到 1.x 无标题栏形态后，引擎 UI 的避让层）。
 *
 * - macOS hiddenInset：红绿灯叠加在画布左上（trafficLightPosition {13,22}），
 *   侧栏 logo 行加左肩留白并升级为窗口拖拽条（行内按钮以外区域可拖动）。
 * - Windows/Linux titleBarOverlay：内容整体避开系统窗控条（env 回落 0 时无副作用）。
 *
 * 上游 UI 的类名是 CSS Modules 哈希产物（实测形如 `PBw8SG_logoRow`，前缀式
 * 哈希），用 `[class*="logoRow"]` 属性包含匹配稳定命中本地名。仅 Electron 内
 * 注入；浏览器直连引擎时不产生任何窗口适配样式。
 */

const STYLE_TAG_ID = 'kstock-window-chrome'

const WINDOW_CHROME_CSS = `
[class*="logoRow"] {
  padding-left: 80px;
  -webkit-app-region: drag;
}

[class*="logoRow"] button,
[class*="logoRow"] a,
[class*="logoRow"] input {
  -webkit-app-region: no-drag;
}

#root {
  padding-top: env(titlebar-area-height, 0px);
  box-sizing: border-box;
}
`

/** 注入窗口壳适配样式表；返回卸用 disposer（幂等：已存在则不再注入）。 */
export function applyWindowChromeCss(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (!/Electron/.test(navigator.userAgent)) return () => {}
  const existing = document.querySelector<HTMLStyleElement>(`style[data-kstock="${STYLE_TAG_ID}"]`)
  if (existing !== null) return () => existing.remove()
  const tag = document.createElement('style')
  tag.dataset.kstock = STYLE_TAG_ID
  tag.textContent = WINDOW_CHROME_CSS
  document.head.appendChild(tag)
  return () => tag.remove()
}
