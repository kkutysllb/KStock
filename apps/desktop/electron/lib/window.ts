/**
 * 主窗口创建（2.0：直接加载引擎地址）。
 *
 * 沿用 1.x 的无标题栏窗口形态：macOS hiddenInset（红绿灯叠加在页面左上，
 * 落地页/登录页导航条自带 -webkit-app-region: drag 拖拽区与 86px 左留白）；
 * Windows/Linux 用系统 Window Controls Overlay（titleBarOverlay 提供原生
 * 最小化/最大化/关闭，无需自绘窗控 IPC 桥）。壳只负责：进程内嵌、导航
 * 白名单、外链转交。
 */

import {
  app,
  BrowserWindow,
  shell,
} from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  attachChromeThemeBridge,
  chromeColorsFor,
  loadChromeTheme,
  SHELL_TITLEBAR_HEIGHT,
} from "./chrome";
import { logMain } from "./logger";

let mainWindow: BrowserWindow | null = null;
let engineOrigin = "";
let zoomFactor = 1.0;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/** 主窗口导航到地址（引擎重启后带新 token 重载用）。 */
export function loadInMainWindow(url: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) void mainWindow.loadURL(url);
}

/**
 * 创建主窗口并加载引擎引导地址（通常带启动 token）。
 * 引擎重启后可再次调用 ``loadInMainWindow`` 换新地址。
 */
export function createMainWindow(targetUrl: string): BrowserWindow {
  engineOrigin = safeOrigin(targetUrl);

  // 首帧主题取持久化值（renderer 上报后经 chrome 桥热切换）；
  // 亮色主题不再吃深色底启动黑闪。
  const theme = loadChromeTheme();
  const { background, symbol } = chromeColorsFor(theme);

  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    // 无标题栏：macOS 红绿灯垂直居中于引擎 UI 的 48px 顶栏带（会话标题栏
    // 与侧栏品牌行同高，避让样式由 @kstock/client-brand 注入）；
    // Windows/Linux 的 hidden + titleBarOverlay——WCO 原生层只画右上按钮簇，
    // 标题栏本体是引擎 UI 自己的 48px 顶栏带（不下推内容，见 client-brand
    // windowChrome 的 WINDOWS_TITLEBAR_CSS）；overlay 高度与该带对齐。
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: process.platform === "darwin" ? { x: 13, y: 18 } : undefined,
    titleBarOverlay:
      process.platform === "darwin"
        ? undefined
        : {
            color: background,
            symbolColor: symbol,
            height: SHELL_TITLEBAR_HEIGHT,
          },
    backgroundColor: background,
    // Windows 任务栏图标（macOS Dock 图标由 app.dock.setIcon 单独设置）。
    icon: resolveWindowIcon(),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  window.once("ready-to-show", () => {
    logMain("窗口 ready-to-show");
    // 启动默认最大化：显示前先最大化，避免先以普通尺寸闪现再放大。
    window.maximize();
    window.show();
  });

  // ready-to-show 超时兜底：引擎冷启动较慢（profile 组装/插件编译）时
  // 先让窗口可见，用户看到的是空白加载而非「应用没启动」。
  setTimeout(() => {
    if (!window.isDestroyed() && !window.isVisible()) {
      logMain("ready-to-show 超时（10s），强制显示窗口");
      window.maximize();
      window.show();
    }
  }, 10000);

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    logMain(`did-fail-load: code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    logMain(`render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });
  window.webContents.on("did-finish-load", () => {
    logMain("渲染进程 did-finish-load");
  });

  // 捕获渲染层 console 输出（含未捕获异常）：打包态排障的主诊断面。
  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const levelName = ["verbose", "info", "warning", "error"][level] ?? String(level);
    logMain(`renderer[${levelName}]: ${message} (${sourceId}:${line})`);
  });

  // 外部 http(s) 链接（新闻外链、GitHub 链接等）一律转交系统浏览器；
  // 其余 window.open 全部拒绝——不允许应用创建新窗口。
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // 壳主题桥：renderer 主题上报 → 底色/overlay 热切换 + 持久化；
  // Windows 侧含 focus/restore/show overlay 重放（按钮簇丢失/黑块补丁）。
  attachChromeThemeBridge(window);

  // 主框架导航拦截：仅允许引擎自身 origin（同源 302/登录跳转/SPA 路由）。
  // 无地址栏窗口整页跳转难以察觉，防止把窗口导航到外部站点。
  window.webContents.on("will-navigate", (event, url) => {
    const allowed = safeOrigin(url) === engineOrigin;
    if (!allowed) {
      event.preventDefault();
      logMain("will-navigate blocked: " + url);
    }
  });

  // 快捷键兜底（无应用菜单平台的唯一入口；macOS 菜单同键重复触发无害）。
  registerShortcuts(window);

  void window.loadURL(targetUrl);

  mainWindow = window;
  return window;
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/**
 * 无菜单平台的快捷键：开发者工具 / 重载 / 缩放。
 * 2.0 删除了旧 SPA 的库导航快捷键——导航归引擎 UI 的侧栏。
 */
function registerShortcuts(window: BrowserWindow): void {
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const ctrl = input.control || input.meta;
    const shift = input.shift;

    if (input.key === "F12" || (ctrl && shift && input.key.toLowerCase() === "i")) {
      event.preventDefault();
      if (window.webContents.isDevToolsOpened()) window.webContents.closeDevTools();
      else window.webContents.openDevTools();
      return;
    }
    if (!ctrl) return;

    const key = input.key.toLowerCase();
    if (key === "r" && !shift) {
      event.preventDefault();
      window.webContents.reload();
    } else if (key === "r" && shift) {
      event.preventDefault();
      window.webContents.reloadIgnoringCache();
    } else if ((input.key === "+" || input.key === "=") && !shift) {
      event.preventDefault();
      adjustZoom(0.1);
    } else if (input.key === "-" && !shift) {
      event.preventDefault();
      adjustZoom(-0.1);
    } else if (input.key === "0" && !shift) {
      event.preventDefault();
      resetZoom();
    }
  });
}

export function adjustZoom(delta: number): void {
  zoomFactor = Math.min(2.0, Math.max(0.6, zoomFactor + delta));
  mainWindow?.webContents.setZoomFactor(zoomFactor);
}

export function resetZoom(): void {
  zoomFactor = 1.0;
  mainWindow?.webContents.setZoomFactor(zoomFactor);
}

/**
 * 定位窗口/任务栏图标路径。
 *
 * electron-builder 打包后 macOS 用 ``icon.icns``、Windows 用 ``icon.ico``，
 * 由构建流程注入；开发态需手动指定 png，否则 Windows 任务栏、Linux dock
 * 会回退到 Electron 默认图标。
 *
 * 档位顺序由大到小（图标重构）：任务栏/窗口图标会被系统按 DPI 放大，
 * 首选 16px 或 32px 素材必然糊；`icons/` 现在含 16→1024 全档且逐档形制不同
 * （详见 spec §4），因此优先取 256。
 */
function resolveWindowIcon(): string | undefined {
  const base = join(app.getAppPath(), "build");
  const candidates = [
    join(base, "icons", "256x256.png"),
    join(base, "icons", "128x128.png"),
    join(base, "icons", "32x32.png"),
  ];
  return candidates.find((p) => existsSync(p));
}
