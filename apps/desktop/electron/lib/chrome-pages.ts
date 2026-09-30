/**
 * 壳配色策略：KStock 自有静态页（登录 / 初始化 / 落地）的底色判定。
 *
 * 与 chrome.ts 分开是为了可单测——chrome.ts 顶部 import 了 electron，而这里只有
 * 纯字符串判定，能在 node:test 里直接跑（chrome-pages.test.ts 会拿仓库里的两个
 * HTML 与它对齐，防「壳改了前缀、页面没跟上」这类漂移）。
 *
 * 背景：这些页的画布恒为暗色（kstock-pages.css 的 `.auth-shell` / `.landing-shell`
 * 无明暗分支），而壳的 WCO overlay 配色来自引擎 UI 上报的持久化主题——亮色主题
 * 用户会看到一整块白色按钮带压在暗色画布上。判定因此走两条路：
 *
 * 1. **页面自报**（PAGE_THEME_PREFIX，权威）：页面在自己 <head> 里声明底色。
 *    这些页的 URL 由引擎路由决定——实测登录是 `/login?next=…`、初始化是 `/setup`、
 *    落地是 `/`，还有直接访问 `/kstock/*.html` 的情形；主进程写死名单必漏
 *    （第一版只列了 `/kstock/*.html`，真实登录流程全漏，用户截图里的白块就是它）。
 * 2. **导航快路径**（DARK_STATIC_ROUTES）：did-navigate 时先切一帧，避免页面脚本
 *    执行前仍用持久化（亮色）配色闪白。注意首屏那次导航发生在壳挂监听之前，
 *    所以快路径**覆盖不到「一启动就是登录页」**——正因如此自报不能省。
 *
 * 两条路都只切配色、不写持久化：用户偏好仍归引擎 UI 的主题上报。
 */

/** 页面自报底色前缀（值：dark | light；仅切配色，不持久化）。 */
export const PAGE_THEME_PREFIX = "__kstock_page_theme__:";

/** 自有暗色静态页的路由名单（引擎路由 + 直接访问文件两条形态）。 */
export const DARK_STATIC_ROUTES = [
  "/",
  "/login",
  "/setup",
  "/kstock/kstock-auth.html",
  "/kstock/kstock-landing.html",
] as const;

/** 该 URL 是否 KStock 的暗色静态页路由（解析失败按否处理）。 */
export function isDarkStaticRoute(url: string): boolean {
  try {
    return (DARK_STATIC_ROUTES as readonly string[]).includes(new URL(url).pathname);
  } catch {
    return false;
  }
}
