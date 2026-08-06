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
  updateDownload: "update:download",
  updateInstall: "update:install",
  updateProgress: "update:progress",
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
  updateCheck(): Promise<{ available: boolean; version: string } | null>;
  updateDownload(onProgress?: (p: { downloaded: number; total: number }) => void): Promise<void>;
  updateInstall(): Promise<void>;
}
