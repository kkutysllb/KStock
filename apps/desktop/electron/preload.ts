/**
 * preload：在渲染进程暴露 ``window.kstockDesktop`` 桥接 API（contextBridge）。
 *
 * 替换原前端对 ``@tauri-apps/api`` 的全部调用。sandbox 下仅可用 contextBridge + ipcRenderer。
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC, type MenuCommand } from "./lib/ipc-channels";

const api = {
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

  openExternal(url: string): Promise<void> {
    return ipcRenderer.invoke(IPC.shellOpenExternal, url);
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

  updateCheck(): Promise<{ available: boolean; version: string } | null> {
    return ipcRenderer.invoke(IPC.updateCheck);
  },

  updateDownload(
    onProgress?: (p: { downloaded: number; total: number }) => void,
  ): Promise<void> {
    if (onProgress) {
      const handler = (
        _event: unknown,
        payload: { downloaded: number; total: number },
      ) => onProgress(payload);
      ipcRenderer.on(IPC.updateProgress, handler);
    }
    return ipcRenderer.invoke(IPC.updateDownload, Boolean(onProgress));
  },

  updateInstall(): Promise<void> {
    return ipcRenderer.invoke(IPC.updateInstall);
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
