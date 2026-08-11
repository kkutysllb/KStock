/**
 * 自动更新（electron-updater）—— 后台静默下载模式。
 *
 * 流程：
 * 1. check 发现新版本 → 主进程立即触发后台下载（autoDownload = true），
 *    渲染进程无感知，不显示任何 UI；
 * 2. 下载完成后主进程主动推 IPC.updateReady 事件到渲染进程，
 *    渲染进程此时才显示"新版本已就绪，点击重启安装"图标；
 * 3. 用户点击 → IPC.updateInstall → 同步终止 gateway 进程树 →
 *    quitAndInstall 退出主进程并由安装器替换文件后重启。
 *
 * 安装重启的关键时序：gateway 若未彻底退出，Windows 安装器会因 .exe
 * 被占用导致替换失败、macOS 会因进程残留导致重启后端口冲突。
 */

import { app, ipcMain, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { IPC } from "./ipc-channels";
import { getMainWindow } from "./window";

/** 安装前终止 gateway 的注册句柄，由 main.ts 在进程初始化后注入。 */
let shutdownGateway: (() => Promise<void>) | null = null;

/**
 * 注入 gateway 终止函数。
 *
 * main.ts 持有 ``GatewayProcess`` 实例，但 updater 初始化早于 gateway 创建。
 * 用回调注入避免循环依赖，同时保证安装重启前能同步调用 gateway 的终止逻辑。
 */
export function setGatewayShutdownHandler(fn: () => Promise<void>): void {
  shutdownGateway = fn;
}

let initialized = false;

/** 最近一次 checkForUpdates 发现的版本号（用于 update-ready 推送）。 */
let pendingVersion: string | null = null;

/** 向主窗口推送"更新已就绪"事件。 */
function notifyUpdateReady(window: BrowserWindow | null, version: string): void {
  if (!window || window.isDestroyed()) return;
  window.webContents.send(IPC.updateReady, { version });
}

/** 初始化 autoUpdater 全局行为与 IPC。 */
export function initUpdater(): void {
  if (initialized) return;
  initialized = true;

  // 启用后台自动下载：检测到新版本后立即下载，用户无感知。
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // 仅 GitHub releases（latest-mac.yml / latest.yml）。
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "kkutysllb",
    repo: "KStock",
  });

  autoUpdater.on("error", (error) => {
    // 静默记录，不打断用户（后台下载失败时用户不会被骚扰）。
    console.error("[updater]", error);
  });

  // 检测到新版本时记录版本号，渲染进程不主动通知（保持后台静默）。
  autoUpdater.on("update-available", (info) => {
    pendingVersion = info.version || null;
    console.log(`[updater] 发现新版本 v${pendingVersion}，后台下载中…`);
  });

  // 下载完成：主动推送到渲染进程，此时才让 UI 显示"已就绪"图标。
  autoUpdater.on("update-downloaded", (info) => {
    const version = info.version || pendingVersion || "unknown";
    console.log(`[updater] 新版本 v${version} 下载完成，通知渲染进程`);
    notifyUpdateReady(getMainWindow(), version);
  });

  // 渲染进程（菜单"检查更新"）触发：返回版本号，但不等下载完成。
  // 下载完成后由 update-downloaded 事件主动推送。
  ipcMain.handle(IPC.updateCheck, async () => {
    if (!app.isPackaged) return null;
    try {
      const result = await autoUpdater.checkForUpdates();
      const info = result?.updateInfo;
      if (!info || info.version === app.getVersion()) return null;
      pendingVersion = info.version;
      return { available: true, version: info.version };
    } catch {
      return null;
    }
  });

  // 用户点击"重启安装"时：终止 gateway → 延迟退出 → 安装器替换文件 → 重启。
  ipcMain.handle(IPC.updateInstall, async () => {
    // 1. 同步终止 gateway 进程树（等待子进程真正退出，否则 Windows
    //    安装器替换 .exe 时因文件占用失败、macOS 重启后端口冲突）。
    if (shutdownGateway) {
      try {
        await shutdownGateway();
      } catch (err) {
        console.error("[updater] gateway 终止失败，继续安装:", err);
      }
    }
    // 2. 短延迟让渲染进程完成 IPC 返回与资源释放。
    // 3. quitAndInstall(isSilent=false, isForceRunAfterQuit=true)：关闭所有
    //    窗口 → 退出主进程 → 运行安装器替换文件 → 重启应用。
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 200);
  });
}
