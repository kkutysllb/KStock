/**
 * 主窗口创建与窗口控制 IPC（对齐原 ``tauri.conf.json`` 窗口配置）。
 */

import {
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

/** dev 模式渲染层地址（由 ``VITE_DEV_SERVER_URL`` 注入，缺省指向 Vite dev server）。 */
function devServerUrl(): string | null {
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
    window.show();
  });

  // ready-to-show 超时兜底：若加载卡住（协议异常 / 静态资源缺失），2s 后
  // 强制显示窗口，让用户能看到错误而非以为应用未启动。
  setTimeout(() => {
    if (!window.isDestroyed() && !window.isVisible()) {
      logMain("ready-to-show 超时（2s），强制显示窗口");
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
