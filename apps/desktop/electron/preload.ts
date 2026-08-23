/**
 * preload：在渲染进程暴露 ``window.kstockDesktop`` 桥接 API（contextBridge）。
 *
 * 替换原前端对 ``@tauri-apps/api`` 的全部调用。sandbox 下仅可用 contextBridge + ipcRenderer。
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC, type MenuCommand, type UpdateCheckResult } from "./lib/ipc-channels";

const api = {
  /** 宿主平台（win32 / darwin / linux）。渲染层用它在 Windows 下启用自绘窗控。 */
  platform: process.platform,

  /** 系统菜单 / 托盘命令（对齐原 listen("kstock://menu")）。返回取消订阅函数。 */
  onMenuCommand(cb: (command: MenuCommand) => void): () => void {
    const handler = (_event: unknown, payload: { command: MenuCommand }) => {
      cb(payload.command);
    };
    ipcRenderer.on(IPC.menuCommand, handler);
    return () => ipcRenderer.removeListener(IPC.menuCommand, handler);
  },

  toggleMaximize(): Promise<void> {
    return ipcRenderer.invoke(IPC.windowToggleMaximize);
  },

  // Windows 无框窗口自绘窗控（WindowControls 组件）。
  minimize(): Promise<void> {
    return ipcRenderer.invoke(IPC.windowMinimize);
  },

  closeWindow(): Promise<void> {
    return ipcRenderer.invoke(IPC.windowClose);
  },

  isMaximized(): Promise<boolean> {
    return ipcRenderer.invoke(IPC.windowIsMaximized);
  },

  /** 订阅最大化状态变化（图标在 最大化/还原 间切换）。返回取消订阅函数。 */
  onMaximizeChange(cb: (maximized: boolean) => void): () => void {
    const handler = (_event: unknown, payload: { maximized: boolean }) => {
      cb(payload.maximized);
    };
    ipcRenderer.on(IPC.windowMaximizeChanged, handler);
    return () => ipcRenderer.removeListener(IPC.windowMaximizeChanged, handler);
  },

  openExternal(url: string): Promise<void> {
    return ipcRenderer.invoke(IPC.shellOpenExternal, url);
  },

  /**
   * 在系统文件管理器中打开本地目录。target 限定为白名单枚举，
   * 主进程负责解析为绝对路径并拒绝任何未声明的目标，避免渲染层
   * 通过此通道访问任意本地目录。
   */
  openPath(target: "logs" | "app-data"): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.shellOpenPath, target);
  },

  /** 应用元信息：版本号 / 名称 / 平台。版本号取自 package.json (`app.getVersion`)。 */
  appInfo(): Promise<{ version: string; name: string; platform: NodeJS.Platform }> {
    return ipcRenderer.invoke(IPC.appInfo);
  },

  restartGateway(): Promise<string> {
    return ipcRenderer.invoke(IPC.gatewayRestart);
  },

  gatewayStatus(): Promise<{ port: number; running: boolean; childAlive: boolean }> {
    return ipcRenderer.invoke(IPC.gatewayStatus);
  },

  appDataDir(): Promise<string> {
    return ipcRenderer.invoke(IPC.gatewayAppDataDir);
  },

  saveArtifact(
    name: string,
    bytes: Uint8Array,
  ): Promise<{ saved: boolean; path?: string }> {
    return ipcRenderer.invoke(IPC.shellSaveArtifact, name, bytes);
  },

  showNotification(
    title: string,
    body: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    return ipcRenderer.invoke(IPC.showNotification, title, body);
  },

  updateCheck(): Promise<UpdateCheckResult> {
    return ipcRenderer.invoke(IPC.updateCheck);
  },

  updateInstall(): Promise<void> {
    return ipcRenderer.invoke(IPC.updateInstall);
  },

  onUpdateReady(cb: (info: { version: string }) => void): () => void {
    const handler = (_event: unknown, payload: { version: string }) =>
      cb(payload);
    ipcRenderer.on(IPC.updateReady, handler);
    return () => ipcRenderer.off(IPC.updateReady, handler);
  },
};

contextBridge.exposeInMainWorld("kstockDesktop", api);

// 捕获渲染层未处理异常转发到主进程日志，定位打包态黑屏（JS 执行但
// React 未 mount / import 顶层报错等）。sandbox 下 ipcRenderer.send 可用。
window.addEventListener("error", (event) => {
  const detail = `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`;
  ipcRenderer.send(IPC.rendererError, { kind: "error", detail });
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error
    ? `${event.reason.name}: ${event.reason.message}`
    : String(event.reason);
  ipcRenderer.send(IPC.rendererError, { kind: "unhandledrejection", detail: reason });
});

export type DesktopBridgeApi = typeof api;
