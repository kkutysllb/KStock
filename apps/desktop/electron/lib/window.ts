/**
 * 主窗口创建与窗口控制 IPC（对齐原 ``tauri.conf.json`` 窗口配置）。
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  type WebContents,
} from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { logMain } from "./logger";
import { IPC } from "./ipc-channels";

let mainWindow: BrowserWindow | null = null;
let zoomFactor = 1.0;

/**
 * dev 模式渲染层地址。
 *
 * 仅在 **未打包** 时读取 ``VITE_DEV_SERVER_URL``；打包态强制返回 null，
 * 确保 App 绝不会回连 dev server（即使环境变量意外泄漏到打包进程）。
 * ``app.isPackaged`` 是 Electron 运行时的硬性判断，比环境变量可靠。
 */
function devServerUrl(): string | null {
  if (app.isPackaged) return null;
  return process.env.VITE_DEV_SERVER_URL ?? null;
}

/** prod 模式渲染层入口（app:// 自定义协议）。 */
const PROD_ENTRY = "app://localhost/index.html";

/**
 * 允许在窗口内导航的 origin 白名单。
 *
 * 打包态只有 ``app://localhost``；dev 态追加 Vite dev server origin
 * （HMR 整页刷新会触发 will-navigate）。
 */
function allowedInternalOrigins(): string[] {
  const origins = ["app://localhost"];
  const dev = devServerUrl();
  if (dev) {
    try {
      origins.push(new URL(dev).origin);
    } catch {
      // 非法 VITE_DEV_SERVER_URL 时忽略 dev origin。
    }
  }
  return origins;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function sendMenuCommand(command: string): void {
  mainWindow?.webContents.send(IPC.menuCommand, { command });
}

/**
 * 非 macOS 平台采用无框窗口（Windows/Linux 自绘标题栏 + 窗控按钮），
 * macOS 保留系统红绿灯。渲染层 WindowControls 组件负责 Windows 下的
 * 最小化/最大化/关闭按钮，各顶栏自带 -webkit-app-region 拖拽区。
 */
const isFrameless = process.platform !== "darwin";

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    // Windows/Linux 无框：无系统标题栏与菜单栏；菜单功能全部迁移到托盘。
    // Alt 呼出的隐藏菜单栏也不再需要（应用菜单在 main.ts 置空）。
    frame: !isFrameless,
    autoHideMenuBar: isFrameless,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    // macOS Overlay 标题栏下红绿灯按钮位置（对齐原 trafficLightPosition）。
    trafficLightPosition: { x: 13, y: 22 },
    backgroundColor: "#030d0b",
    // Windows 任务栏图标（macOS Dock 图标由 app.dock.setIcon 单独设置）。
    icon: resolveWindowIcon(),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
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

  // ready-to-show 超时兜底：若加载卡住（协议异常 / 静态资源缺失），2s 后
  // 强制显示窗口，让用户能看到错误而非以为应用未启动。
  setTimeout(() => {
    if (!window.isDestroyed() && !window.isVisible()) {
      logMain("ready-to-show 超时（2s），强制显示窗口");
      window.maximize();
      window.show();
    }
  }, 2000);

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    logMain(`did-fail-load: code=${errorCode} desc=${errorDescription} url=${validatedURL}`);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    logMain(`render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });
  window.webContents.on("did-finish-load", () => {
    logMain("渲染进程 did-finish-load");
  });

  // 最大化状态推送给渲染层：Windows 自绘窗控按钮需要在
  // Square（最大化）/ Copy（还原）图标间切换。
  const notifyMaximizeState = () => {
    if (window.isDestroyed()) return;
    window.webContents.send(IPC.windowMaximizeChanged, {
      maximized: window.isMaximized(),
    });
  };
  window.on("maximize", notifyMaximizeState);
  window.on("unmaximize", notifyMaximizeState);

  // 无框平台没有应用菜单（菜单已迁到托盘），菜单里注册的窗口级快捷键
  // 全部失效，这里用 before-input-event 补齐，行为与原菜单一一对应。
  if (isFrameless) {
    registerFramelessShortcuts(window);
  }

  // 捕获渲染层所有 console 输出（含未捕获异常，Chromium 会以 error level 打入 console）。
  // 这是定位打包态黑屏的决定性诊断手段——main 进程可看到 React 抛出的具体错误。
  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const levelName = ["verbose", "info", "warning", "error"][level] ?? String(level);
    logMain(`renderer[${levelName}]: ${message} (${sourceId}:${line})`);
  });

  // 外部 http(s) 链接一律转交系统浏览器；其余 window.open 全部拒绝。
  // 不允许应用创建任何新窗口：子窗口会继承 preload 桥（kstockDesktop）
  // 且未注册 open handler，file:// 等自定义协议更不能获得窗口。
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // 主框架导航拦截（will-navigate）：仅允许应用自身 origin（SPA 入口与刷新）。
  // 防止被注入的渲染层脚本把整个窗口导航到任意外部站点——应用无边框无地址栏，
  // 整页跳转用户难以察觉，且新页面会成为外部 origin 的请求源与钓鱼载体。
  const internalOrigins = allowedInternalOrigins();
  window.webContents.on("will-navigate", (event, url) => {
    let allowed = false;
    try {
      allowed = internalOrigins.includes(new URL(url).origin);
    } catch {
      allowed = false;
    }
    if (!allowed) {
      event.preventDefault();
      logMain("will-navigate blocked: " + url);
    }
  });

  const url = devServerUrl();
  if (url) {
    void window.loadURL(url);
    window.webContents.openDevTools();
  } else {
    void window.loadURL(PROD_ENTRY);
  }

  mainWindow = window;
  return window;
}

/** 注册窗口控制 IPC handler。 */
export function registerWindowIpc(): void {
  // 渲染进程未捕获异常转发（preload 注册的全局 error/unhandledrejection 捕获器）。
  ipcMain.on(IPC.rendererError, (_event, payload: { kind: string; detail: string }) => {
    logMain(`renderer ${payload.kind}: ${payload.detail}`);
  });

  ipcMain.handle(IPC.windowToggleMaximize, () => {
    const win = mainWindow;
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });

  // Windows 自绘窗控按钮（WindowControls 组件）的三个动作。
  ipcMain.handle(IPC.windowMinimize, () => mainWindow?.minimize());
  ipcMain.handle(IPC.windowClose, () => mainWindow?.close());
  ipcMain.handle(IPC.windowIsMaximized, () => mainWindow?.isMaximized() ?? false);

  ipcMain.handle(IPC.windowSetZoom, (_event, factor: number) => {
    zoomFactor = Math.min(2.0, Math.max(0.6, factor));
    mainWindow?.webContents.setZoomFactor(zoomFactor);
  });

  ipcMain.handle(IPC.windowReload, () => {
    mainWindow?.webContents.reload();
  });

  ipcMain.handle(IPC.windowToggleDevtools, () => {
    const contents: WebContents | undefined = mainWindow?.webContents;
    if (!contents) return;
    if (contents.isDevToolsOpened()) contents.closeDevTools();
    else contents.openDevTools();
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
 * 无框平台快捷键兜底（对齐原应用菜单 accelerator）。
 *
 * 菜单迁入托盘后，托盘菜单项的 accelerator 不会注册为窗口级快捷键，
 * Ctrl+N / Ctrl+R / Ctrl+= 等只能在这里手动补齐。preventDefault 避免
 * 渲染层（如文本编辑器）再响应同一组合。
 */
function registerFramelessShortcuts(window: BrowserWindow): void {
  window.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const ctrl = input.control || input.meta;
    const shift = input.shift;

    // F12 / Ctrl+Shift+I 开发者工具（无菜单后 Windows 唯一入口）。
    if (input.key === "F12" || (ctrl && shift && input.key.toLowerCase() === "i")) {
      event.preventDefault();
      if (window.webContents.isDevToolsOpened()) window.webContents.closeDevTools();
      else window.webContents.openDevTools();
      return;
    }
    if (!ctrl) return;

    // 视图：重载 / 缩放（对齐原「视图」菜单）。
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
    // 文件：新任务 / 报告库 / 策略库（sendMenuCommand 走渲染层既有处理链）。
    } else if (key === "n" && !shift) {
      event.preventDefault();
      sendMenuCommand("new-task");
    } else if (key === "l" && shift) {
      event.preventDefault();
      sendMenuCommand("open-reports");
    } else if (key === "g" && shift) {
      event.preventDefault();
      sendMenuCommand("open-strategies");
    // 应用：偏好设置 / 检查更新。
    } else if (input.key === "," && !shift) {
      event.preventDefault();
      sendMenuCommand("open-settings");
    } else if (key === "u" && shift) {
      event.preventDefault();
      sendMenuCommand("check-update");
    }
  });
}

/**
 * 定位窗口/任务栏图标路径。
 *
 * electron-builder 打包后 macOS 用 ``icon.icns``、Windows 用 ``icon.ico``，
 * 由构建流程注入；开发态需手动指定 png，否则 Windows 任务栏、Linux dock
 * 会回退到 Electron 默认图标。macOS Dock 图标另有 ``app.dock.setIcon``。
 */
function resolveWindowIcon(): string | undefined {
  const base = join(__dirname, "..", "build");
  const candidates = [
    join(base, "icons", "32x32.png"),
    join(base, "icons", "128x128.png"),
  ];
  return candidates.find((p) => existsSync(p));
}
