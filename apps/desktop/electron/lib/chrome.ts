/**
 * 窗口壳主题桥（Windows 标题栏重绘 + 黑屏补丁，参考 KCoder 桌面壳实测方案）。
 *
 * WCO（Window Controls Overlay）渲染模型：原生层只绘制右上角按钮簇
 * （``color`` 填按钮簇底色），标题栏本体由页面绘制——KStock 引擎 UI 的
 * 48px 品牌栏兼作标题栏（``-webkit-app-region: drag`` 见
 * @kstock/client-brand windowChrome），按钮簇叠在其右侧。本模块负责主进程侧：
 *
 * 1. **主题跟随**：引擎 UI 明暗双主题（``body[data-ds-dark-theme]``）运行时
 *    可切，窗口底色与 overlay 配色必须同步切换。renderer 侧探测器经
 *    console 前缀 ``__kstock_theme__:dark|light`` 上报（KCoder WATCH_JS
 *    同款信道，无 IPC 桥）；
 * 2. **overlay 丢失重放**（Windows 实测坑）：最小化/恢复/弹窗交互后按钮簇
 *    会消失或变黑块——focus/restore/show 时从 WeakMap 重放最近一次 overlay；
 * 3. **延迟重放**：Windows 应用 overlay 是异步的，首次设置可能被丢弃，
 *    250/800ms 各补一次（KCoder 同款间隔）；
 * 4. **底色持久化**：主题选择落 ``userData/kstock-chrome.json``，下次启动
 *    窗口底色/overlay 直接用对——亮色主题用户不再吃启动黑闪（首帧在
 *    renderer 上报前只有持久化值可依）。
 */

import { app } from "electron";
import type { BrowserWindow } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { logMain } from "./logger";

/** 标题栏带高（引擎 UI 顶栏带统一 48px，macOS 红绿灯带同款对齐值）。 */
export const SHELL_TITLEBAR_HEIGHT = 48;

/** renderer → 主进程主题上报前缀（值：dark | light）。 */
const THEME_REPORT_PREFIX = "__kstock_theme__:";

/** WCO 按钮簇右侧避让宽度（KCoder 实测值：三按钮 ≈138px）。 */
export const TITLEBAR_PAD_RIGHT = 138;

type ChromeTheme = "dark" | "light";

/** 主题 → 壳配色。取值对齐 @kstock/client-brand tokens：底色=画布 token，
 * 符号色=label 系（暗 #d6d8dc 近 label-primary，亮 #5b6b64 = label-secondary）。 */
export function chromeColorsFor(theme: ChromeTheme): { background: string; symbol: string } {
  return theme === "light"
    ? { background: "#f2f7f5", symbol: "#5b6b64" }
    : { background: "#030d0b", symbol: "#d6d8dc" };
}

/** 每窗口最近一次应用的 overlay（重放用；窗口销毁后自动回收）。 */
const lastOverlay = new WeakMap<BrowserWindow, Electron.TitleBarOverlay>();

function chromeStateFile(): string {
  return join(app.getPath("userData"), "kstock-chrome.json");
}

/** 读取持久化主题（损坏/缺席回落暗色——产品主方案）。 */
export function loadChromeTheme(): ChromeTheme {
  try {
    const raw = JSON.parse(readFileSync(chromeStateFile(), "utf8")) as { theme?: unknown };
    return raw.theme === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function saveChromeTheme(theme: ChromeTheme): void {
  try {
    const dir = dirname(chromeStateFile());
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(chromeStateFile(), JSON.stringify({ theme }, null, 2), "utf8");
  } catch (err) {
    logMain(`chrome 主题持久化失败（不阻塞）: ${err instanceof Error ? err.message : err}`);
  }
}

/** 应用壳主题：窗口底色 +（Windows）WCO overlay，带延迟重放与重放登记。 */
export function applyChromeTheme(win: BrowserWindow, theme: ChromeTheme): void {
  if (win.isDestroyed()) return;
  const { background, symbol } = chromeColorsFor(theme);
  win.setBackgroundColor(background);
  if (process.platform !== "win32") return;

  const overlay: Electron.TitleBarOverlay = {
    color: background,
    symbolColor: symbol,
    height: SHELL_TITLEBAR_HEIGHT,
  };
  const apply = (): void => {
    try {
      if (!win.isDestroyed()) win.setTitleBarOverlay(overlay);
    } catch {
      // 全屏切换等瞬间 setTitleBarOverlay 可能抛错；重放事件会再补。
    }
  };
  apply();
  // Windows 异步应用 overlay 可能丢弃首次设置，延迟重放兜底。
  for (const delay of [250, 800]) {
    setTimeout(() => {
      if (!win.isDestroyed()) apply();
    }, delay);
  }
  lastOverlay.set(win, overlay);
}

/**
 * 为主窗口挂主题桥：
 * - console 信道上接 renderer 主题上报 → 应用壳主题 + 持久化；
 * - Windows focus/restore/show 重放 overlay（按钮簇丢失/黑块补丁）。
 * 窗口销毁时自动摘除监听。
 */
export function attachChromeThemeBridge(win: BrowserWindow): void {
  const { webContents } = win;

  const onConsoleMessage = (_event: unknown, _level: unknown, message: string): void => {
    if (!message.startsWith(THEME_REPORT_PREFIX)) return;
    const value = message.slice(THEME_REPORT_PREFIX.length);
    if (value !== "dark" && value !== "light") return;
    logMain(`chrome 主题上报：${value}`);
    applyChromeTheme(win, value);
    saveChromeTheme(value);
  };

  webContents.on("console-message", onConsoleMessage);

  const replayOverlay = (): void => {
    const overlay = lastOverlay.get(win);
    if (overlay === undefined) return;
    try {
      win.setTitleBarOverlay(overlay);
    } catch {
      // 忽略：下一次事件再补。
    }
  };
  if (process.platform === "win32") {
    win.on("focus", replayOverlay);
    win.on("restore", replayOverlay);
    win.on("show", replayOverlay);
  }

  win.once("closed", () => {
    webContents.removeListener("console-message", onConsoleMessage);
  });
}
