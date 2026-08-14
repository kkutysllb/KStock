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

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function sendMenuCommand(command: string): void {
  mainWindow?.webContents.send(IPC.menuCommand, { command });
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    autoHideMenuBar: false,
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

  // 捕获渲染层所有 console 输出（含未捕获异常，Chromium 会以 error level 打入 console）。
  // 这是定位打包态黑屏的决定性诊断手段——main 进程可看到 React 抛出的具体错误。
  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    const levelName = ["verbose", "info", "warning", "error"][level] ?? String(level);
    logMain(`renderer[${levelName}]: ${message} (${sourceId}:${line})`);
  });

  // 外部链接（http/https）在系统浏览器打开，其余链接在窗口内导航。
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // 防护：阻止渲染层主框架意外导航（如链接点击未 preventDefault、拖拽 URL 等）。
  // 主框架导航会使 React 应用卸载，用户看到「KStock 正在加载」且全部状态丢失。
  // dev server（localhost:1420）与 app:// 协议的内部跳转予以放行。
  window.webContents.on("will-navigate", (event, url) => {
    const parsed = (() => { try { return new URL(url); } catch { return null; } })();
    if (!parsed) { event.preventDefault(); return; }
    // dev 模式允许 Vite HMR 的 ws 与同源页面跳转
    const isDevNav = !app.isPackaged && parsed.origin === "http://localhost:1420";
    const isAppScheme = parsed.protocol === "app:";
    if (!isDevNav && !isAppScheme) {
      logMain(`will-navigate 拦截非预期导航: ${url}`);
      event.preventDefault();
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
