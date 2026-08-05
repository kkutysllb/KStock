/**
 * KStock Electron 主进程入口。
 *
 * 串联：app:// 协议 → 内置 gateway 子进程 → 主窗口 → 系统菜单/托盘 → 自动更新。
 * 退出时联动终止 gateway 进程树（对齐原 Tauri ``RunEvent::Exit`` 行为）。
 */

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
} from "electron";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  appDataDirectory,
  GatewayProcess,
} from "./lib/gateway";
import {
  buildAppMenu,
  buildTray,
} from "./lib/menu";
import { registerAppProtocol, registerPrivilegedScheme } from "./lib/protocol";
import { initUpdater } from "./lib/updater";
import {
  createMainWindow,
  getMainWindow,
  registerWindowIpc,
} from "./lib/window";
import { IPC } from "./lib/ipc-channels";

// 必须在 app.ready 之前注册 privileged scheme。
registerPrivilegedScheme();

// 单实例锁：避免多开各自拉起 gateway 抢 18001 端口。
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    registerAppProtocol();
    registerWindowIpc();
    registerGatewayIpc();
    registerShellIpc();
    initUpdater();

    // macOS dev 模式下 Dock 默认显示 Electron 图标；手动设置应用图标
    // 让开发态与打包态视觉一致。打包态由 electron-builder 注入 .icns。
    if (process.platform === "darwin" && !app.isPackaged) {
      setDockIcon();
    }

    // 自动拉起内置 gateway（开发态和打包态统一由主进程托管）。
    try {
      await gateway.ensureStarted();
    } catch (err) {
      console.error("[gateway] 自动启动失败（开发模式可忽略）:", err);
    }

    Menu.setApplicationMenu(buildAppMenu());
    createMainWindow();
    buildTray();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  // 应用退出时联动终止内置 gateway 进程树。
  app.on("before-quit", () => {
    gateway.stop();
  });
}

const gateway = new GatewayProcess();

/** 注册 gateway 进程管理 IPC。 */
function registerGatewayIpc(): void {
  ipcMain.handle(IPC.gatewayStart, async () => gateway.ensureStarted());
  ipcMain.handle(IPC.gatewayStop, () => gateway.stop());
  ipcMain.handle(IPC.gatewayRestart, async () => gateway.restart());
  ipcMain.handle(IPC.gatewayStatus, async () => gateway.status());
  ipcMain.handle(IPC.gatewayAppDataDir, () => appDataDirectory());
}

/** 注册宿主能力 IPC（打开外链、保存文件）。 */
function registerShellIpc(): void {
  ipcMain.handle(IPC.shellOpenExternal, async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("仅允许打开 http(s) 链接");
    }
    await shell.openExternal(url);
  });

  ipcMain.handle(
    IPC.shellSaveArtifact,
    async (_event, name: string, bytes: Uint8Array) => {
      const filename = safeArtifactFilename(name);
      const parent = getMainWindow();
      const { canceled, filePath } = parent
        ? await dialog.showSaveDialog(parent, { defaultPath: filename })
        : await dialog.showSaveDialog({ defaultPath: filename });
      if (canceled || !filePath) return { saved: false };
      await writeFile(filePath, Buffer.from(bytes));
      return { saved: true, path: filePath };
    },
  );
}

/** 对齐 Rust safe_artifact_filename：剥离路径分隔符与非法字符。 */
function safeArtifactFilename(name: string): string {
  const filename =
    name
      .split(/[\\/]/)
      .filter((part) => part.length > 0)
      .pop() ?? name;
  const cleaned = filename
    .trim()
    .replace(/[\\/:"*?<>|]/g, "_");
  return cleaned.length > 0 ? cleaned : "artifact";
}

/**
 * macOS dev 模式下设置 Dock 图标。
 *
 * 打包后的 .app 由 electron-builder 注入 icon.icns 作为 Dock 图标；
 * 开发态走 ``electron .`` 时 Dock 仍显示 Electron 默认图标，需手动调
 * ``app.dock.setIcon`` 注入应用图标 png。
 */
function setDockIcon(): void {
  const candidates = [
    join(app.getAppPath(), "build", "icons", "128x128@2x.png"),
    join(app.getAppPath(), "build", "icons", "128x128.png"),
  ];
  const iconPath = candidates.find((p) => existsSync(p));
  if (!iconPath) return;
  const icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) app.dock.setIcon(icon);
}


