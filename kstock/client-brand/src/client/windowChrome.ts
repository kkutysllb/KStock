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
 *    - macOS hiddenInset：红绿灯独立一行（引擎 topStrip 48px 拖拽条，
 *      trafficLightPosition {13,17} 灯组居中其内），品牌行保持自然行距
 *      落在灯条之下——与 KCoder 桌面端头部同款双行布局；品牌行/标题行
 *      兼作拖拽条（行内按钮除外）。
 *    - Windows/Linux（WCO 模型，参考 KCoder 桌面壳）：原生层只画右上
 *      按钮簇（titleBarOverlay height 48），标题栏本体是引擎 UI 自己的
 *      48px 顶栏带——内容不下推（旧版 `#root { padding-top:
 *      env(titlebar-area-height) }` 会产生 40px 空带 + 双栏），品牌行统一
 *      48px。顶栏带内贴窗口右缘的控件由 applyCaptionAvoidance() 实测后
 *      左移让位（按钮簇宽取 WCO 实测，失效时回落 138 × 显示缩放）。
 *      整带 `-webkit-app-region: drag`（本层公共规则）。
 *
 * 另有主题探测器（applyThemeWatcher）：引擎 UI 明暗切换经 console 前缀
 * `__kstock_theme__:` 上报主进程（chrome.ts 壳主题桥），驱动窗口底色与
 * WCO overlay 配色热切换——亮色主题不再吃深色壳。
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
 * `#root` 前缀抬升特异度（ID+类 > 上游任意类组合），不依赖注入顺序。
 * 注意：不做内容下推——macOS 灯组与 Windows 按钮簇都叠在引擎 UI 自己
 * 的顶栏带上（标题栏本体 = 页面绘制，WCO 原生层只画右上按钮簇）。 */
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
`

/** macOS 专属：红绿灯独立一行（引擎 topStrip 48px，补丁 24），品牌行
 * 在灯条之下累计下移 30px 落于其下——对齐 KCoder 桌面端头部布局，不再与
 * 红绿灯同排（原 84px 左肩设计随双行布局退役）。折叠轨（56px 宽）容不下
 * 品牌，轨内容整体压到灯组下方（灯组底 y=30，折叠轨顶 margin 34 = y 52 起）。
 * 壳未注入 data-platform="darwin"，上游 topStrip（灯组行）不渲染，折叠按钮
 * 回落进品牌行——这里把它提回灯组行：品牌行作定位锚并放行溢出，按钮绝对
 * 定位到行上方 26px（y 10..38，中心 24 对齐灯组中心 23.5），折叠轨恢复流内。
 * 设置弹层是全窗口面板，且经 portal 挂在 document.body（#root 前缀够不到）：
 * 「返回工作区」行下移 30px 让开灯组。 */
const MACOS_TRAFFIC_LIGHTS_CSS = `
#root [class*="logoRow"] {
  height: 48px;
  padding: 0 0 0 16px;
  margin: 30px 0 8px;
  position: relative;
  overflow: visible;
}

#root [class*="logoRow"] > [class*="toggle"] {
  position: absolute;
  top: -26px;
  right: 0;
}

#root [class*="collapsed"] [class*="logoRow"] {
  height: 36px;
  padding: 0;
  margin: 34px 0 12px;
  position: static;
  overflow: hidden;
}

#root [class*="collapsed"] [class*="logoRow"] > [class*="toggle"] {
  position: relative;
  top: auto;
  right: auto;
}

body [class*="navBack"] {
  margin-top: 30px;
}
`

/** Windows/Linux 专属：WCO 按钮簇（右上，y 0..48）避让。标题栏本体 =
 * 引擎 UI 顶栏带（与 macOS 同款 48px 统一），避让方向相反——不躲左上
 * 灯组，而是让顶栏带内贴窗口右缘的控件让位按钮簇。
 *
 * 这里只留几何修正；右让位由 applyCaptionAvoidance() 的实测位移完成——
 * 上游的钩子是 CSS Modules 哈希类名，写死选择器必然随上游改版失效
 * （旧版 `[class*="header"]:has(> [class*="headerRight"])` 就从未命中过：
 * headerRight 在 3.0.5 引擎里已不存在，138px 让位一直是死代码，Windows
 * 上右上控件被按钮簇压住就是这么来的）。 */
const WINDOWS_TITLEBAR_CSS = `
#root [class*="logoRow"] {
  height: 48px;
  margin: -6px 0 8px;
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
 * 仅 Electron 生效，浏览器直连引擎时不产生任何窗口适配样式；macOS 叠加
 * 红绿灯避让，Windows/Linux 叠加 WCO 按钮簇避让。
 */
export function applyWindowChromeCss(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (!/Electron/.test(navigator.userAgent)) return () => {}
  const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent)
  return injectStyleTag(
    WINDOW_CHROME_TAG_ID,
    WINDOW_CHROME_CSS + (isMac ? MACOS_TRAFFIC_LIGHTS_CSS : WINDOWS_TITLEBAR_CSS),
  )
}

/** 原生按钮簇高度（与壳 titleBarOverlay height / window.ts SHELL_TITLEBAR_HEIGHT 对齐）。 */
const TITLEBAR_BAND = 48

/** 按钮簇区域内的取样步长与取样高度：够密以命中窄控件，又不必逐像素命中测试。 */
const CAPTION_SAMPLE_STEP = 24
const CAPTION_SAMPLE_Y = [8, 24]

/** Windows 100% 缩放下「最小化/最大化/关闭」三按钮簇的实测宽度（屏上截屏核对）。 */
const CAPTION_BUTTONS_WIDTH = 138

/**
 * 读 WCO 暴露的 `env(titlebar-area-width)`。
 *
 * 注意：本版 Electron 上该变量会失效/滞后——实测按钮簇明明画在屏上（截屏核对
 * 过 `— ▢ ✕`），它仍返回整窗宽。因此调用方只把它当参考值，不可盲信。
 */
function measureTitlebarAreaWidth(): number {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;left:0;top:0;height:1px;width:env(titlebar-area-width,100vw);' +
    'visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const width = probe.getBoundingClientRect().width
  probe.remove()
  return width
}

/**
 * 原生按钮簇覆盖窗口右侧的 CSS px 宽度。
 *
 * 优先用 WCO 实测值（DPI 与按钮数自适应），读数不合理（0 或 ≥ 半窗 = 上面
 * 描述的失效形态）时回落到 138 × devicePixelRatio（100%/125%/150% 缩放依次
 * 138/172/207，与系统按钮簇同步放大）。宁可多留一点（控件左移几个 px）也不能
 * 少留——少留的表现是控件被按钮压住点不动。
 */
function captionInsetWidth(): number {
  const measured = Math.round(window.innerWidth - measureTitlebarAreaWidth())
  if (measured > 0 && measured < window.innerWidth / 2) return measured
  return Math.round(CAPTION_BUTTONS_WIDTH * (window.devicePixelRatio || 1))
}

/**
 * 把落进按钮簇区域的顶栏控件左移，直到退出该区域。
 *
 * 逐次实测而非写死选择器：右上控件挂在哪个容器上、右侧栏是否展开，都会改变
 * 「哪一行真的贴到窗口右缘」——右侧栏展开时主栏顶栏离右缘还有一千多 px
 * （残留 padding 会留出莫名空白），关掉它就贴上了。上游类名是 CSS Modules
 * 哈希产物，写死必然随改版失效（旧版 138px 让位就是这么变成死代码的）。
 *
 * 同层只位移**最右**的那个控件：flex 行里给多个同级同时加外边距会累计位移，
 * 而只动最右者会让整行右侧控件一起左移（行内余量由 filler 吸收）。按钮簇区域
 * 本就被系统绘制的不透明按钮盖住，让出的空间不显示内容，故无视觉代价。
 */
function avoidCaptionButtons(applied: Map<HTMLElement, string>): void {
  for (const [element, base] of applied) element.style.marginRight = base
  applied.clear()
  if (document.body === null) return

  const zoneLeft = window.innerWidth - captionInsetWidth()
  if (zoneLeft >= window.innerWidth) return

  const offenders = new Set<HTMLElement>()
  for (let x = zoneLeft + 1; x < window.innerWidth; x += CAPTION_SAMPLE_STEP) {
    for (const y of CAPTION_SAMPLE_Y) {
      for (const node of document.elementsFromPoint(x, y)) {
        if (!(node instanceof HTMLElement)) continue
        if (node === document.body || node === document.documentElement) continue
        const rect = node.getBoundingClientRect()
        // 顶栏带内的行/控件；高于整条带的整列容器不可位移（那是布局骨架）
        if (rect.width === 0 || rect.height === 0 || rect.height > TITLEBAR_BAND) continue
        if (rect.top > TITLEBAR_BAND || rect.bottom < 0) continue
        if (rect.right > zoneLeft) offenders.add(node)
      }
    }
  }
  if (offenders.size === 0) return

  // 只保留最内层：外层行容器由内层控件带动，否则会把整行外框一起推开
  const list = [...offenders]
  const inner = list.filter((el) => !list.some((other) => other !== el && el.contains(other)))

  // 同层只取最右者（见上文：flex 行内多元素位移会累计）
  const rightmost = new Map<HTMLElement, HTMLElement>()
  for (const element of inner) {
    const parent = element.parentElement
    if (parent === null) continue
    const current = rightmost.get(parent)
    if (
      current === undefined ||
      element.getBoundingClientRect().right > current.getBoundingClientRect().right
    ) {
      rightmost.set(parent, element)
    }
  }

  for (const element of rightmost.values()) {
    const overflow = Math.round(element.getBoundingClientRect().right - zoneLeft)
    if (overflow <= 0) continue
    applied.set(element, element.style.marginRight)
    element.style.marginRight = `${overflow}px`
  }
}

/**
 * 顶栏右侧让位原生按钮簇（仅 Electron 非 macOS；其余平台不产生任何副作用）。
 *
 * 只在「顶栏带内有变动」时重算：聊天流式输出会持续改 DOM，无差别重算等于
 * 每百毫秒级做几十次命中测试；而按钮簇遮挡只与顶栏带有关。返回卸用 disposer。
 */
export function applyCaptionAvoidance(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (!/Electron/.test(navigator.userAgent)) return () => {}
  if (/Macintosh|Mac OS X/.test(navigator.userAgent)) return () => {}

  const applied = new Map<HTMLElement, string>()
  let timer: number | undefined

  const schedule = (): void => {
    if (timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      avoidCaptionButtons(applied)
    }, 120)
  }
  const touchesTitlebarBand = (records: MutationRecord[]): boolean =>
    records.some((record) => {
      const target = record.target
      if (!(target instanceof HTMLElement)) return false
      const rect = target.getBoundingClientRect()
      return rect.top < TITLEBAR_BAND
    })

  const disposers: Array<() => void> = [
    () => {
      if (timer !== undefined) clearTimeout(timer)
      for (const [element, base] of applied) element.style.marginRight = base
      applied.clear()
    },
  ]
  const observe = (): void => {
    avoidCaptionButtons(applied)
    window.addEventListener('resize', schedule)
    disposers.push(() => window.removeEventListener('resize', schedule))
    if (document.body !== null) {
      const observer = new MutationObserver((records) => {
        if (touchesTitlebarBand(records)) schedule()
      })
      observer.observe(document.body, { childList: true, subtree: true })
      disposers.push(() => observer.disconnect())
    }
  }
  if (document.body !== null) observe()
  else document.addEventListener('DOMContentLoaded', observe, { once: true })

  return () => {
    for (const dispose of disposers) dispose()
  }
}

/** 壳主题上报前缀（chrome.ts attachChromeThemeBridge 消费）。 */
const THEME_REPORT_PREFIX = '__kstock_theme__:'
/** 读当前壳主题；主题系统未落属性时返回 undefined（启动初态，
 * 缺席 ≠ 亮色——KCoder 同款判据的否定面：body[data-ds-dark-theme] 或
 * html colorScheme 任一落定才可判）。 */
function readChromeTheme(): 'dark' | 'light' | undefined {
  if (document.body === null) return undefined
  const scheme = document.documentElement.style.colorScheme
  if (scheme === 'dark' || scheme === 'light') return scheme
  if (document.body.hasAttribute('data-ds-dark-theme')) return 'dark'
  return undefined
}

/**
 * 主题探测器（仅 Electron）：引擎 UI 明暗切换时经 console 前缀上报主进程，
 * 驱动窗口底色与 WCO overlay 热切换。
 *
 * 首报对齐 KCoder 的注入点语义（did-finish-load 后注入）：等页面 load
 * 完成再报——实测上游主题系统启动会先落 colorScheme=light、随后才应用
 * 用户持久化的 dark（DOM 自带启动瞬态），首报过早会让壳配色闪中间态。
 * load 前一切上报（观察器/系统翻转）都被压住；load 后 80ms 去抖收敛
 * 连跳；1s 兜底：load 迟迟不来时按当前 DOM 猜一次，防壳配色停在旧值。
 * 返回卸用 disposer（幂等）。
 */
export function applyThemeWatcher(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (!/Electron/.test(navigator.userAgent)) return () => {}

  let primed = false
  let settled = false
  let settleTimer: number | undefined
  let reportTimer: number | undefined

  const emit = (value: 'dark' | 'light'): void => {
    console.log(THEME_REPORT_PREFIX + value)
  }
  const emitNow = (): void => {
    const value = readChromeTheme()
    if (value !== undefined) emit(value)
  }
  // 结算前（首报未发）一切主题变化都不提前上报——它们多半是上游启动
  // 瞬态（实测 load 后 ~190ms 才落用户持久化主题），统一等结算首发读终值。
  const schedule = (): void => {
    if (!settled) return
    if (reportTimer !== undefined) clearTimeout(reportTimer)
    reportTimer = setTimeout(() => {
      reportTimer = undefined
      emitNow()
    }, 80)
  }
  const prime = (): void => {
    if (primed) return
    primed = true
    // 结算首发：load 后 400ms 统一读一次（KCoder 120/400ms settle 同款）。
    settleTimer = setTimeout(() => {
      settled = true
      emitNow()
    }, 400)
  }

  const disposers: Array<() => void> = [
    () => {
      if (settleTimer !== undefined) clearTimeout(settleTimer)
      if (reportTimer !== undefined) clearTimeout(reportTimer)
    },
  ]
  const observe = (): void => {
    if (document.body !== null) {
      const bodyObserver = new MutationObserver(schedule)
      bodyObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-ds-dark-theme', 'class'],
      })
      disposers.push(() => bodyObserver.disconnect())
    }
    const htmlObserver = new MutationObserver(schedule)
    htmlObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    })
    disposers.push(() => htmlObserver.disconnect())
  }

  if (document.body !== null) {
    observe()
  } else {
    document.addEventListener('DOMContentLoaded', observe, { once: true })
  }

  // 首报：load 完成（或早已 complete，如 HMR 重挂）后结算。
  if (document.readyState === 'complete') prime()
  else window.addEventListener('load', prime, { once: true })

  // 兜底：load 迟迟不触发（异常页）时按当前 DOM 猜一次。
  const fallback = setTimeout(() => prime(), 1000)
  disposers.push(() => clearTimeout(fallback))

  // 系统档翻转可能不经 DOM 属性直达（KCoder 同款兜底）。
  try {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const onScheme = (): void => schedule()
    media.addEventListener('change', onScheme)
    disposers.push(() => media.removeEventListener('change', onScheme))
  } catch {
    /* matchMedia 不可用时仅靠 DOM 观察器 */
  }

  return () => {
    for (const dispose of disposers) dispose()
  }
}
