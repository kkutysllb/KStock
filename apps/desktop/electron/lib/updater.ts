/**
 * 自动更新（electron-updater）—— 后台静默下载 + 系统通知/菜单交互。
 *
 * 2.0 起渲染层是引擎 web 工作区（无 KStock IPC 桥），更新交互全部收归
 * 主进程：
 * 1. 启动后台静默检查，发现新版本立即下载（用户无感知）；
 * 2. 下载完成弹系统通知；点击通知或菜单「检查更新…」弹出确认对话框；
 * 3. 确认安装：同步终止引擎进程树 → quitAndInstall（安装器替换文件后重启）。
 *
 * 安装重启的关键时序：引擎若未彻底退出，Windows 安装器会因 .exe 被占用
 * 导致替换失败、macOS 会因进程残留导致重启后端口冲突。
 */

import { app, dialog, Notification, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { logMain } from "./logger";
import { getMainWindow } from "./window";

/** 安装前终止引擎的注册句柄，由 main.ts 注入。 */
let shutdownEngine: (() => Promise<void>) | null = null;

export function setEngineShutdownHandler(fn: () => Promise<void>): void {
  shutdownEngine = fn;
}

let initialized = false;

/** 最近一次 checkForUpdates 发现的版本号。 */
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

/** 解析新版本发布说明：优先 updater 自带，缺失回退 GitHub Release body，按版本缓存。 */
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

/** 发布说明 → 确认对话框 detail（截断，markdown 源文直接展示）。 */
function notesForDialog(notes: string | null): string {
  if (!notes) return "";
  return notes.length > 800 ? `${notes.slice(0, 800)}\n…（完整说明见发布页）` : notes;
}

/** 对话框包装：有父窗口时挂父窗口（模态），否则独立弹窗。 */
function showBox(
  parent: BrowserWindow | null | undefined,
  options: Electron.MessageBoxOptions,
): Promise<Electron.MessageBoxReturnValue> {
  return parent && !parent.isDestroyed()
    ? dialog.showMessageBox(parent, options)
    : dialog.showMessageBox(options);
}

/** 重启并安装：终止引擎进程树 → quitAndInstall。 */
async function installUpdate(): Promise<void> {
  if (shutdownEngine) {
    try {
      await shutdownEngine();
    } catch (err) {
      logMain(
        `[updater] 引擎终止失败，继续安装: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  setTimeout(() => {
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      // quitAndInstall 失败（安装器缺失 / 文件被占用 / 权限不足）必须让用户
      // 看见并保留重试路径；否则只剩一条 unhandled 异常，用户以为「点了没反应」。
      const message = error instanceof Error ? error.message : String(error);
      logMain(`[updater] quitAndInstall 失败：${message}`);
      void showBox(getMainWindow(), {
        type: "error",
        title: "安装更新失败",
        message: `安装更新失败：${message}`,
        detail: "可重试，或从 GitHub Releases 手动下载安装包。",
        buttons: ["重试", "知道了"],
        defaultId: 0,
        cancelId: 1,
      }).then((result) => {
        if (result.response === 0) void checkForUpdatesInteractive(getMainWindow() ?? undefined);
      });
    }
  }, 200);
}

/**
 * 手动检查更新（菜单/托盘入口）：阻塞式对话框反馈结果；
 * 有新版本时二次确认后安装。
 */
export async function checkForUpdatesInteractive(parent?: BrowserWindow): Promise<void> {
  if (!app.isPackaged) {
    await showBox(parent, {
      type: "info",
      title: "检查更新",
      message: "开发模式不支持检查更新",
    });
    return;
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const info = result?.updateInfo;
    const version = info?.version ?? app.getVersion();
    if (!info || version === app.getVersion()) {
      await showBox(parent, {
        type: "info",
        title: "检查更新",
        message: `已是最新版本（v${app.getVersion()}）`,
      });
      return;
    }
    pendingVersion = version;
    const notes = await resolveReleaseNotes(version, normalizeUpdaterReleaseNotes(info));
    const choice = await showBox(parent ?? getMainWindow(), {
      type: "info",
      title: "发现新版本",
      message: `新版本 v${version} 可用（当前 v${app.getVersion()}）`,
      detail: notesForDialog(notes),
      buttons: ["重启并安装", "稍后"],
      defaultId: 0,
      cancelId: 1,
    });
    if (choice.response === 0) await installUpdate();
  } catch (err) {
    await showBox(parent, {
      type: "error",
      title: "检查更新",
      message: "检查更新失败",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

/** 初始化 autoUpdater：feed / 事件 / 启动后台静默检查。 */
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

  autoUpdater.on("update-not-available", (info) => {
    logMain(
      `[updater] 无可用更新（feed 最新 v${info.version}，当前 v${app.getVersion()}）`,
    );
  });

  autoUpdater.on("update-available", (info) => {
    pendingVersion = info.version || null;
    logMain(`[updater] 发现新版本 v${pendingVersion}，后台下载中…`);
    if (info.version) {
      void resolveReleaseNotes(info.version, normalizeUpdaterReleaseNotes(info));
    }
  });

  // 下载完成：系统通知（点击进入安装确认），用户不点也不丢——
  // autoInstallOnAppQuit 保证退出时兜底安装。
  autoUpdater.on("update-downloaded", (info) => {
    const version = info.version || pendingVersion || "unknown";
    logMain(`[updater] 新版本 v${version} 下载完成，弹系统通知`);
    void resolveReleaseNotes(version, normalizeUpdaterReleaseNotes(info));
    if (!Notification.isSupported()) return;
    const notification = new Notification({
      title: "KStock 新版本已就绪",
      body: `v${version} 下载完成，点击查看并安装。退出应用时也会自动安装。`,
      silent: true,
    });
    notification.on("click", () => {
      const win = getMainWindow();
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
      void checkForUpdatesInteractive(win ?? undefined);
    });
    notification.show();
  });

  // 启动后台静默检查（打包态）：延迟 8s 避开引擎冷启动的 IO 峰值，只做一次。
  // 失败静默——日志已记录。
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 8_000);
  }
}
