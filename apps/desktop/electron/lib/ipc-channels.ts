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
  windowMinimize: "window:minimize",
  windowClose: "window:close",
  windowIsMaximized: "window:is-maximized",
  // 主进程 → 渲染进程：最大化状态变化（自绘窗控按钮切换 最大化/还原图标）
  windowMaximizeChanged: "window:maximize-changed",
  // 内置 gateway 进程管理（渲染层实际消费的只有重启通道）
  gatewayRestart: "gateway:restart",
  // 宿主能力
  shellOpenExternal: "shell:open-external",
  shellOpenPath: "shell:open-path",
  shellSaveArtifact: "shell:save-artifact",
  // 应用元信息（侧边栏 logo 下拉的「关于 KStock」用）
  appInfo: "app:info",
  // 系统通知（任务完成/失败提醒；窗口聚焦时主进程自动降级不打扰）
  showNotification: "ui:show-notification",
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
  | "open-strategies"
  | "open-factors"
  | "open-selections"
  | "check-update";

/**
 * 手动检查更新的返回结果，区分「已最新 / 有新版本 / 检查失败」，
 * 让渲染层能给用户明确反馈（toast），而不是永远静默。
 */
export type UpdateCheckResult =
  | { status: "available"; version: string; releaseNotes?: string }
  | { status: "latest"; version: string }
  | { status: "error"; message: string };
/**
 * 桥接 API 契约的单一事实源是 preload.ts 末尾的 `export type DesktopBridgeApi = typeof api`；
 * 渲染进程侧的镜像接口在 src/lib/desktopBridge.ts（DesktopBridgeApi）。
 * 三者（preload api 字面量 / 本文件通道名 / 渲染层接口）必须同步修改，
 * 不在此处再维护第三份接口副本（历史上曾漂移为死代码，已删除）。
 */
