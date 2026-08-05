/**
 * 自动更新（electron-updater），对齐原 ``@tauri-apps/plugin-updater`` 行为。
 *
 * - 禁用 autoDownload：保留侧边栏手动触发 + 下载进度语义；
 * - check 返回 ``{available, version} | null``；download 推送进度；install 退出并安装重启。
 * - 非打包环境（开发态）检查失败时静默返回 null，不影响页面。
 */

import { app, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { IPC } from "./ipc-channels";
import { getMainWindow } from "./window";

let initialized = false;

/** 初始化 autoUpdater 全局行为与 IPC。 */
export function initUpdater(): void {
  if (initialized) return;
  initialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // 仅 GitHub releases（latest-mac.yml / latest.yml）。
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "kkutysllb",
    repo: "KStock",
  });

  autoUpdater.on("error", (error) => {
    // 静默记录，不打断用户。
    console.error("[updater]", error);
  });

  ipcMain.handle(IPC.updateCheck, async () => {
    if (!app.isPackaged) return null;
    try {
      const result = await autoUpdater.checkForUpdates();
      const info = result?.updateInfo;
      if (!info || info.version === app.getVersion()) return null;
      return { available: true, version: info.version };
    } catch {
      return null;
    }
  });

  ipcMain.handle(
    IPC.updateDownload,
    async (_event, onProgress?: boolean) => {
      try {
        if (onProgress) {
          autoUpdater.on("download-progress", (progress) => {
            getMainWindow()?.webContents.send(IPC.updateProgress, {
              downloaded: progress.transferred,
              total: progress.total,
            });
          });
        }
        await autoUpdater.downloadUpdate();
      } catch (error) {
        throw error instanceof Error ? error.message : String(error);
      }
    },
  );

  ipcMain.handle(IPC.updateInstall, async () => {
    // quitAndInstall 会关闭所有窗口、安装、重启；设短延迟让渲染进程完成收尾。
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 100);
  });
}
