/**
 * KStock 环境背景：还原 1.x 桌面端的全局五层渐变网格背景
 * （apps/desktop/src/styles.css `.landing-shell` 等 8 个顶层容器共享的定义），
 * 两层绿色径向光晕 + 52px 网格线 + 纵向渐隐，亮色为薄荷纸衍生方案。
 *
 * 引擎 UI 的画布由 token（--dsw-alias-bg-base 等）驱动且可能被运行时内联
 * 变量覆盖，因此这里的品牌背景用样式表 + !important 声明，作为品牌层的
 * 画布兜底；面板层级表面仍由 token 控制，渐变只在可见画布处透出。
 */

const STYLE_TAG_ID = 'kstock-brand-background'

const BACKGROUND_CSS = `
/* KStock 品牌环境背景（亮色：薄荷纸衍生；暗色：1.x 深绿黑原案） */
body {
  background-color: #f2f7f5 !important;
  background-image:
    radial-gradient(circle at 72% 16%, rgba(23, 130, 103, 0.07), transparent 34%),
    radial-gradient(circle at 20% 82%, rgba(16, 90, 71, 0.05), transparent 32%),
    linear-gradient(rgba(23, 130, 103, 0.030) 1px, transparent 1px),
    linear-gradient(90deg, rgba(23, 130, 103, 0.026) 1px, transparent 1px),
    linear-gradient(180deg, #f7fbf9 0%, #edf4f1 100%) !important;
  background-position: center, center, 0 0, 0 0, 0 0 !important;
  background-size: auto, auto, 52px 52px, 52px 52px, auto !important;
}

body[data-ds-dark-theme] {
  background-color: #030d0b !important;
  background-image:
    radial-gradient(circle at 72% 16%, rgba(36, 132, 104, 0.085), transparent 34%),
    radial-gradient(circle at 20% 82%, rgba(22, 76, 61, 0.065), transparent 32%),
    linear-gradient(rgba(129, 205, 178, 0.026) 1px, transparent 1px),
    linear-gradient(90deg, rgba(129, 205, 178, 0.022) 1px, transparent 1px),
    linear-gradient(180deg, #061511 0%, #020a08 100%) !important;
  background-position: center, center, 0 0, 0 0, 0 0 !important;
  background-size: auto, auto, 52px 52px, 52px 52px, auto !important;
}
`

/** 注入品牌背景样式表；返回卸用 disposer（幂等：已存在则不再注入）。 */
export function applyBackgroundCss(): () => void {
  if (typeof document === 'undefined') return () => {}
  const existing = document.querySelector<HTMLStyleElement>(`style[data-kstock="${STYLE_TAG_ID}"]`)
  if (existing !== null) return () => existing.remove()
  const tag = document.createElement('style')
  tag.dataset.kstock = STYLE_TAG_ID
  tag.textContent = BACKGROUND_CSS
  document.head.appendChild(tag)
  return () => tag.remove()
}
