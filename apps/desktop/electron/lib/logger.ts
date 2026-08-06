/**
 * Electron 主进程文件日志。
 *
 * gateway 子进程有独立的 ``desktop-gateway.log``（见 gateway.ts）；主进程
 * （窗口/协议/IPC）原本只有 ``console.log``，打包态 Windows 无终端看不到
 * 输出，渲染层问题（黑屏/加载失败/进程崩溃）无从定位。本模块把主进程
 * 关键事件落盘到 ``~/.kstock/logs/desktop-electron.log``，与 gateway 日志
 * 同目录，便于「打开日志目录」菜单一并查看。
 */

import { appendFileSync, mkdirSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LOG_DIR = join(homedir(), ".kstock", "logs");
const LOG_PATH = join(LOG_DIR, "desktop-electron.log");

/** 文件描述符缓存；打开失败后置 -1 不再重试，避免每个日志调用都抛错。 */
let fd: number | null = null;

function ensureFd(): number {
  if (fd !== null) return fd;
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    fd = openSync(LOG_PATH, "a");
  } catch {
    fd = -1;
  }
  return fd;
}

/**
 * 写一条主进程日志。同时输出到 stdout（开发态终端可见）。
 *
 * 不做日志轮转（与 gateway 日志策略一致，由用户经「打开日志目录」菜单
 * 手动清理）；``logMain`` 只在关键事件调用，增长缓慢。
 */
export function logMain(msg: string): void {
  const handle = ensureFd();
  const line = `${new Date().toISOString()} ${msg}`;
  if (handle >= 0) {
    try {
      appendFileSync(handle, `${line}\n`);
    } catch {
      /* 单条写失败忽略，不影响主流程 */
    }
  }
  // eslint-disable-next-line no-console
  console.log(line);
}
