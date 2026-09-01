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
import { IPC, type UpdateCheckResult } from "./ipc-channels";
import { logMain } from "./logger";
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

/** 按版本缓存发布说明（含 null，避免对 GitHub API 重复请求）。 */
const releaseNotesCache = new Map<string, string | null>();

/**
 * 归一化 electron-updater 的 releaseNotes 字段：latest.yml 里可能是字符串，
 * 也可能是按条目的数组（{ note, version }），统一拍平成单个 markdown 串。
 */
function normalizeUpdaterReleaseNotes(info: {
  releaseNotes?:
    | string
    | null
    | Array<{ note?: string | null; version?: string } | string>;
}): string | null {
  const raw = info.releaseNotes;
  if (!raw) return null;
  const notes = (
    typeof raw === "string"
      ? raw
      : raw.map((item) => (typeof item === "string" ? item : item?.note ?? "")).join("\n\n")
  ).trim();
  return notes || null;
}

/**
 * 兜底：拉取 GitHub Release 正文作为发布说明。
 * latest.yml 的 releaseNotes 仅在打包配置了 releaseNotes(File) 时才存在，
 * 历史版本普遍没有——GitHub Provider 场景直接读 Release body 最可靠。
 * 任何失败（网络 / 限流 / 超时）都静默返回 null，不阻塞更新主流程。
 */
async function fetchGitHubReleaseNotes(tag: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/kkutysllb/KStock/releases/tags/${encodeURIComponent(tag)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "KStock-Updater",
        },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { body?: unknown };
    const body = typeof data.body === "string" ? data.body.trim() : "";
    return body || null;
  } catch {
    return null;
  }
}

/**
 * 解析新版本发布说明：优先 updater 自带的 releaseNotes，缺失时回退
 * GitHub Release body，结果按版本缓存。
 */
async function resolveReleaseNotes(
  version: string,
  primary: string | null,
): Promise<string | null> {
  if (primary) {
    releaseNotesCache.set(version, primary);
    return primary;
  }
  if (releaseNotesCache.has(version)) {
    return releaseNotesCache.get(version) ?? null;
  }
  const notes = await fetchGitHubReleaseNotes(`v${version}`);
  releaseNotesCache.set(version, notes);
  return notes;
}

/** 向主窗口推送"更新已就绪"事件（携带发布说明，供图标悬停展示）。 */
function notifyUpdateReady(
  window: BrowserWindow | null,
  version: string,
  releaseNotes?: string,
): void {
  if (!window || window.isDestroyed()) return;
  window.webContents.send(
    IPC.updateReady,
    releaseNotes ? { version, releaseNotes } : { version },
  );
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

  autoUpdater.on("checking-for-update", () => {
    logMain("[updater] 正在检查更新…");
  });

  autoUpdater.on("error", (error) => {
    // 落盘记录，不打断用户（后台下载失败时用户不会被骚扰）。
    logMain(
      `[updater] 更新出错：${error instanceof Error ? error.message : String(error)}`,
    );
  });

  // 已是最新版本（或运行版领先于 feed）：明确记录，不再静默。
  autoUpdater.on("update-not-available", (info) => {
    logMain(
      `[updater] 无可用更新（feed 最新 v${info.version}，当前 v${app.getVersion()}）`,
    );
  });

  // 检测到新版本时记录版本号，渲染进程不主动通知（保持后台静默）。
  // 顺手预热发布说明解析（latest.yml 缺失时预取 GitHub Release body），
  // 让下载完成推送时说明通常已就绪。
  autoUpdater.on("update-available", (info) => {
    pendingVersion = info.version || null;
    logMain(`[updater] 发现新版本 v${pendingVersion}，后台下载中…`);
    if (info.version) {
      void resolveReleaseNotes(info.version, normalizeUpdaterReleaseNotes(info));
    }
  });

  // 下载完成：主动推送到渲染进程，此时才让 UI 显示"已就绪"图标，
  // 并附上新版本发布说明（图标悬停展示）。
  autoUpdater.on("update-downloaded", (info) => {
    const version = info.version || pendingVersion || "unknown";
    logMain(`[updater] 新版本 v${version} 下载完成，通知渲染进程`);
    void (async () => {
      const releaseNotes = await resolveReleaseNotes(
        version,
        normalizeUpdaterReleaseNotes(info),
      );
      notifyUpdateReady(getMainWindow(), version, releaseNotes ?? undefined);
    })();
  });

  // 渲染进程（菜单"检查更新"）触发：返回结构化结果（已最新 / 有新版本 /
  // 检查失败），不等下载完成；下载完成后由 update-downloaded 事件主动推送。
  ipcMain.handle(IPC.updateCheck, async (): Promise<UpdateCheckResult> => {
    logMain(
      `[updater] 收到手动检查更新请求：packaged=${app.isPackaged} ` +
        `currentVersion=${app.getVersion()}`,
    );
    if (!app.isPackaged) {
      logMain("[updater] 未打包环境，跳过检查更新");
      return { status: "error", message: "开发模式不支持检查更新" };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      const info = result?.updateInfo;
      if (!info) {
        logMain(`[updater] 检查完成：已是最新版本 v${app.getVersion()}`);
        return { status: "latest", version: app.getVersion() };
      }
      if (info.version === app.getVersion()) {
        logMain(`[updater] 检查完成：已是最新版本 v${info.version}`);
        return { status: "latest", version: info.version };
      }
      pendingVersion = info.version;
      const releaseNotes = await resolveReleaseNotes(
        info.version,
        normalizeUpdaterReleaseNotes(info),
      );
      logMain(`[updater] 发现新版本 v${info.version}，后台下载中`);
      return releaseNotes
        ? { status: "available", version: info.version, releaseNotes }
        : { status: "available", version: info.version };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logMain(`[updater] 检查更新失败：${message}`);
      return { status: "error", message };
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
        logMain(
          `[updater] gateway 终止失败，继续安装: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
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
