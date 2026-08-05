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

  window.once("ready-to-show", () => window.show());

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
