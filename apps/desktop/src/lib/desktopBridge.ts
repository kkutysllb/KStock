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
  | "check-update";

/** 渲染进程可用的宿主桥接 API。 */
export interface DesktopBridgeApi {
  onMenuCommand(cb: (command: MenuCommand) => void): () => void;
  toggleMaximize(): Promise<void>;
  openExternal(url: string): Promise<void>;
  restartGateway(): Promise<string>;
  gatewayStatus(): Promise<{
    port: number;
    running: boolean;
    childAlive: boolean;
  }>;
  appDataDir(): Promise<string>;
  saveArtifact(
    name: string,
    bytes: Uint8Array,
  ): Promise<{ saved: boolean; path?: string }>;
  updateCheck(): Promise<{ available: boolean; version: string } | null>;
  updateDownload(
    onProgress?: (p: { downloaded: number; total: number }) => void,
  ): Promise<void>;
  updateInstall(): Promise<void>;
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

/** 切换窗口最大化。无宿主桥时静默忽略。 */
export async function toggleWindowMaximize(): Promise<void> {
  try {
    await getDesktopBridge()?.toggleMaximize();
  } catch {
    // 浏览器预览环境无原生窗口，忽略。
  }
}

/**
 * 在系统浏览器打开外链。
 *
 * 无宿主桥时回退到 ``window.open``（浏览器预览环境）。
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;
  const bridge = getDesktopBridge();
  if (bridge) {
    try {
      await bridge.openExternal(url);
      return;
    } catch {
      // 桥接失败时回退。
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
