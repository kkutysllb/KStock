/**
 * Electron 主进程文件日志。
 *
 * gateway 子进程有独立的 ``desktop-gateway.log``（见 gateway.ts）；主进程
 * （窗口/协议/IPC）原本只有 ``console.log``，打包态 Windows 无终端看不到
 * 输出，渲染层问题（黑屏/加载失败/进程崩溃）无从定位。本模块把主进程
 * 关键事件落盘到 ``~/.kstock/logs/desktop-electron.log``，与 gateway 日志
 * 同目录，便于「打开日志目录」菜单一并查看。
 *
 * 覆写语义：每次应用启动首次写入时用 ``w`` 打开（truncate），本次运行
 * 内再追加；避免跨启动无限追加导致日志文件持续膨胀。
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
    // "w" 首次打开即覆盖写入；fd 缓存后本次进程内后续写为追加，
    // 实现「每次启动覆盖、本次运行追加」的语义。
    fd = openSync(LOG_PATH, "w");
  } catch {
    fd = -1;
  }
  return fd;
}

/**
 * 写一条主进程日志。同时输出到 stdout（开发态终端可见）。
 *
 * 每次应用启动首次写入时覆盖旧日志（见 ``ensureFd``），本次运行内追加，
 * 因此文件不会跨启动无限增长。
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
