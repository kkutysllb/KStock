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
  Notification,
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
import { initUpdater, setGatewayShutdownHandler } from "./lib/updater";
import {
  createMainWindow,
  getMainWindow,
  registerWindowIpc,
} from "./lib/window";
import { logMain } from "./lib/logger";
import { IPC } from "./lib/ipc-channels";

// Windows GPU 硬件加速在部分显卡驱动 / 远程桌面（RDP）/ 虚拟机下会导致
// 渲染黑屏（窗口显示但内容空白，Chromium GPU 进程崩溃）。金融桌面应用
// 无 3D / 视频负载，禁用 GPU 加速改用软件渲染兜底，稳定优先于性能。
// macOS / Linux 不受此问题影响，保留硬件加速。
if (process.platform === "win32") {
  app.disableHardwareAcceleration();
}

logMain(`启动：platform=${process.platform} version=${app.getVersion()} packaged=${app.isPackaged}`);

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
      const started = await gateway.ensureStarted();
      logMain(`gateway: ${started}`);
    } catch (err) {
      logMain(`gateway 启动失败: ${err instanceof Error ? err.message : String(err)}`);
    }
    // 注册安装前 gateway 终止回调：更新安装时先同步 kill gateway，
    // 避免 .exe 占用 / 端口冲突导致安装失败。
    setGatewayShutdownHandler(() => gateway.killAndWait());

    Menu.setApplicationMenu(buildAppMenu());
    logMain("ready：创建主窗口");
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
  // 仅发 SIGTERM 不够：uvicorn graceful shutdown 会等待未断开的 SSE 长连接，
  // 且 gateway 子进程 detached（独立进程组），主进程退出后成为孤儿进程
  // 继续占用 18001 端口（macOS 无类似 Windows Job Object 的进程回收机制）。
  // 因此退出时 preventDefault 一次：先销毁窗口断开 SSE，再同步等待
  // killAndWait（SIGTERM + 5s 超时 SIGKILL 兜底）完成后真正退出。
  let gatewayShutdownDone = false;
  app.on("before-quit", (event) => {
    if (gatewayShutdownDone) return;
    event.preventDefault();
    for (const win of BrowserWindow.getAllWindows()) win.destroy();
    gateway
      .killAndWait(5000)
      .catch(() => {})
      .finally(() => {
        gatewayShutdownDone = true;
        app.quit();
      });
  });
}

const gateway = new GatewayProcess();

/** 注册 gateway 进程管理 IPC。 */
function registerGatewayIpc(): void {
  ipcMain.handle(IPC.gatewayStart, async () => gateway.ensureStarted());
  ipcMain.handle(IPC.gatewayStop, () => gateway.killAndWait());
  ipcMain.handle(IPC.gatewayRestart, async () => gateway.restart());
  ipcMain.handle(IPC.gatewayStatus, async () => gateway.status());
  ipcMain.handle(IPC.gatewayAppDataDir, () => appDataDirectory());
}

/** 注册宿主能力 IPC（打开外链、保存文件、系统通知）。 */
function registerShellIpc(): void {
  ipcMain.handle(IPC.shellOpenExternal, async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("仅允许打开 http(s) 链接");
    }
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC.showNotification, (_event, title: string, body: string) => {
    if (!Notification.isSupported()) {
      return { ok: false, reason: "unsupported" };
    }
    // 窗口聚焦时用户正在看应用，弹系统通知只会打扰。
    const win = getMainWindow();
    if (win?.isFocused()) {
      return { ok: false, reason: "focused" };
    }
    const notification = new Notification({
      title: String(title ?? "KStock").slice(0, 120),
      body: String(body ?? "").slice(0, 200),
    });
    notification.on("click", () => {
      const w = getMainWindow();
      if (w) {
        if (w.isMinimized()) w.restore();
        w.show();
        w.focus();
      }
    });
    notification.show();
    return { ok: true };
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


