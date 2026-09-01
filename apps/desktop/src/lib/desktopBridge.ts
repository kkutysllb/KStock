/**
 * 桌面端宿主桥接层。
 *
 * Electron 打包态由 preload 经 contextBridge 注入 ``window.kstockDesktop``；
 * 浏览器预览 / vitest 环境无桥时各方法降级（打开外链回退 ``window.open``、
 * 保存文件返回 unsupported、其余抛友好错误），保证开发态可正常预览。
 *
 * 替换原前端对 ``@tauri-apps/api`` 与 ``isTauriRuntime`` 的全部调用。
 */

/** 系统菜单 / 托盘命令（对齐原 ``kstock://menu`` 事件 payload）。 */
export type MenuCommand =
  | "new-task"
  | "open-settings"
  | "open-reports"
  | "open-strategies"
  | "check-update";

/**
 * 手动检查更新的返回结果，区分「已最新 / 有新版本 / 检查失败」，
 * 让渲染层能给用户明确反馈（toast），而不是永远静默。
 */
export type UpdateCheckResult =
  | { status: "available"; version: string }
  | { status: "latest"; version: string }
  | { status: "error"; message: string };

/**
 * 渲染进程可用的宿主桥接 API。
 *
 * 单一事实源是 electron/preload.ts 的 `export type DesktopBridgeApi = typeof api`；
 * 本接口为其渲染层镜像，修改桥接面时必须与 preload.ts / electron/lib/ipc-channels.ts
 * 三处同步（通道名集中声明在 ipc-channels.ts）。
 */
export interface DesktopBridgeApi {
  /** 宿主平台（win32 / darwin / linux）。Windows 无框窗口据此启用自绘窗控。 */
  readonly platform: string;
  onMenuCommand(cb: (command: MenuCommand) => void): () => void;
  toggleMaximize(): Promise<void>;
  minimize(): Promise<void>;
  closeWindow(): Promise<void>;
  isMaximized(): Promise<boolean>;
  /** 订阅最大化状态变化（自绘窗控按钮在 最大化/还原图标间切换）。 */
  onMaximizeChange(cb: (maximized: boolean) => void): () => void;
  openExternal(url: string): Promise<void>;
  /**
   * 在系统文件管理器中打开本地目录（白名单：logs / app-data）。
   * 渲染层下拉菜单「打开日志目录」使用，主进程拒绝任何未声明的目标。
   */
  openPath(target: "logs" | "app-data"): Promise<{ ok: boolean; error?: string }>;
  /** 应用元信息：版本号 / 名称 / 平台。版本号取自 package.json。 */
  appInfo(): Promise<{ version: string; name: string; platform: NodeJS.Platform }>;
  restartGateway(): Promise<string>;
  saveArtifact(
    name: string,
    bytes: Uint8Array,
  ): Promise<{ saved: boolean; path?: string }>;
  updateCheck(): Promise<UpdateCheckResult>;
  updateInstall(): Promise<void>;
  /** 订阅主进程的"更新已下载就绪"事件（主进程主动推送）。 */
  onUpdateReady(cb: (info: { version: string }) => void): () => void;
  /** 弹系统通知；窗口聚焦/系统不支持时主进程自动降级。 */
  showNotification(title: string, body: string): Promise<{ ok: boolean; reason?: string }>;
}

declare global {
  interface Window {
    kstockDesktop?: DesktopBridgeApi;
  }
}

/** 当前是否运行在桌面端宿主中（preload 已注入桥接 API）。 */
export function isDesktopRuntime(): boolean {
  return Boolean(
    typeof window !== "undefined" && window.kstockDesktop,
  );
}

/** 获取桥接 API；无桥时返回 null。 */
export function getDesktopBridge(): DesktopBridgeApi | null {
  return typeof window !== "undefined" ? window.kstockDesktop ?? null : null;
}

/** 当前是否 Windows 桌面宿主（无框窗口，需自绘窗控与拖拽区）。 */
export function isWindowsDesktop(): boolean {
  return getDesktopBridge()?.platform === "win32";
}

/**
 * 订阅系统菜单 / 托盘命令。
 *
 * 无宿主桥时返回空 unlisten，不报错（浏览器预览环境）。
 */
export function onMenuCommand(
  cb: (command: MenuCommand) => void,
): () => void {
  return getDesktopBridge()?.onMenuCommand(cb) ?? (() => undefined);
}

/**
 * 在系统文件管理器中打开本地目录（白名单 logs / app-data）。
 *
 * 无宿主桥（浏览器预览 / vitest）时静默 no-op；预览环境没有系统文件管理器。
 */
export async function openLocalPath(
  target: "logs" | "app-data",
): Promise<{ ok: boolean; error?: string }> {
  const bridge = getDesktopBridge();
  if (!bridge?.openPath) return { ok: false, error: "no-bridge" };
  try {
    return await bridge.openPath(target);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 获取应用元信息（版本号 / 名称 / 平台）。
 *
 * 无宿主桥时返回安全占位（version="" 让关于菜单降级为「未知版本」）。
 */
export async function fetchAppInfo(): Promise<
  { version: string; name: string; platform: string }
> {
  const bridge = getDesktopBridge();
  if (!bridge?.appInfo) {
    return { version: "", name: "KStock", platform: "unknown" };
  }
  try {
    return await bridge.appInfo();
  } catch {
    return { version: "", name: "KStock", platform: "unknown" };
  }
}

/**
 * 弹系统通知（任务完成/失败/定时任务提醒）。
 *
 * 无宿主桥（浏览器预览 / vitest）或桥接失败时静默忽略——通知是增强
 * 提醒，不能因宿主缺失影响主流程。
 */
export async function showDesktopNotification(
  title: string,
  body: string,
): Promise<void> {
  const bridge = getDesktopBridge();
  if (!bridge?.showNotification) return;
  try {
    await bridge.showNotification(title, body);
  } catch {
    // 通知失败不影响主流程。
  }
}
