/**
 * 自动更新（electron-updater），对齐原 ``@tauri-apps/plugin-updater`` 行为。
 *
 * - 禁用 autoDownload：保留侧边栏手动触发 + 下载进度语义；
 * - check 返回 ``{available, version} | null``；download 推送进度；install 退出并安装重启。
 * - 非打包环境（开发态）检查失败时静默返回 null，不影响页面。
 *
 * 安装重启的关键时序：用户点击安装 → ``installUpdate`` 先让渲染进程收尾 →
 * 同步终止 gateway 进程树（含 SIGKILL 兜底）→ ``quitAndInstall`` 退出主进程并
 * 由安装器替换文件后重启。gateway 若未彻底退出，Windows 安装器会因 .exe
 * 被占用导致替换失败、macOS 会因进程残留导致重启后端口冲突。
 */

import { app, ipcMain } from "electron";
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
