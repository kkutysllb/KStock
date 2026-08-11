/**
 * 主进程 ↔ preload ↔ 渲染进程统一 IPC 通道名。
 *
 * 集中声明避免拼写不一致；preload 用 ``contextBridge`` 暴露的 API 内部全部走这些通道。
 */

export const IPC = {
  // 系统菜单 / 托盘命令推送到渲染进程（对齐原 Tauri 的 ``kstock://menu`` 事件）。
  menuCommand: "kstock:menu",
  // 窗口控制
  windowToggleMaximize: "window:toggle-maximize",
  windowSetZoom: "window:set-zoom",
  windowReload: "window:reload",
  windowToggleDevtools: "window:toggle-devtools",
  // 内置 gateway 进程管理
  gatewayStart: "gateway:start",
  gatewayStop: "gateway:stop",
  gatewayRestart: "gateway:restart",
  gatewayStatus: "gateway:status",
  gatewayAppDataDir: "gateway:app-data-dir",
  // 宿主能力
  shellOpenExternal: "shell:open-external",
  shellSaveArtifact: "shell:save-artifact",
  // 自动更新
  updateCheck: "update:check",
  updateInstall: "update:install",
  // 主进程 → 渲染进程：后台下载完成，可以提示用户安装
  updateReady: "update:ready",
  // 渲染进程未捕获异常转发（preload 全局 error/unhandledrejection 捕获）
  rendererError: "renderer:error",
} as const;

export type MenuCommand =
  | "new-task"
  | "open-settings"
  | "open-reports"
  | "check-update";

/** 渲染进程通过 ``window.kstockDesktop`` 暴露的桥接接口契约。 */
export interface DesktopBridge {
  onMenuCommand(cb: (command: MenuCommand) => void): () => void;
  toggleMaximize(): Promise<void>;
  openExternal(url: string): Promise<void>;
  restartGateway(): Promise<string>;
  gatewayStatus(): Promise<{ port: number; running: boolean; childAlive: boolean }>;
  appDataDir(): Promise<string>;
  saveArtifact(name: string, bytes: Uint8Array): Promise<{ saved: boolean; path?: string }>;
  /**
   * 检查是否有新版本。发现新版本时主进程立即后台下载，本方法仅返回版本号
   * 供"手动检查更新"反馈用；下载完成会通过 onUpdateReady 回调推送。
   */
  updateCheck(): Promise<{ available: boolean; version: string } | null>;
  /** 下载已完成时调用，退出应用并运行安装器替换文件后重启。 */
  updateInstall(): Promise<void>;
  /** 订阅主进程的"更新已下载就绪"事件（主进程主动推送）。 */
  onUpdateReady(cb: (info: { version: string }) => void): () => void;
}
