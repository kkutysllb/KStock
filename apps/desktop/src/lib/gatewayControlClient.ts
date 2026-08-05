// ── gateway 进程控制客户端（对接 Tauri gateway_restart command）──
//
// gateway 的生命周期由 Tauri/Rust 独占管理。纯浏览器 dev:web 没有 Tauri
// 宿主，仍可手工启动 gateway，但不能从页面重启它。

import { GATEWAY_URL } from "./gatewayUrl";

/** gateway 进程控制错误（归一化）。 */
export interface GatewayControlApiError {
  message: string;
  status: number;
}

/** restart 响应。supervised 字段保留以兼容设置页现有调用方。 */
export interface RestartResult {
  message: string;
  supervised: boolean;
}

/**
 * 请求 Tauri 宿主重启 gateway。
 */
export async function restartGateway(): Promise<RestartResult> {
  const win = window as Window & { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  if (!win.__TAURI_INTERNALS__ && !win.__TAURI__) {
    throw { message: "当前运行环境没有 Tauri 宿主，请手动重启 gateway", status: 0 } satisfies GatewayControlApiError;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const message = await invoke<string>("gateway_restart");
    return { message, supervised: false };
  } catch (error) {
    if (isGatewayControlApiError(error)) throw error;
    const message =
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : "重启 gateway 失败";
    throw { message, status: 0 } satisfies GatewayControlApiError;
  }
}

/**
 * 轮询 gateway ``/health`` 直到恢复或超时。
 *
 * gateway 重启后端口短暂不可用，前端用固定间隔轮询 ``/health`` 感知恢复。
 *
 * @param timeoutMs 总超时（默认 20s）
 * @param onProbe   每次探测回调（用于 UI 显示「等待恢复…第 N 次」）
 * @returns 恢复返回 true，超时返回 false
 */
export async function waitForGateway(
  timeoutMs = 20000,
  onProbe?: (attempt: number) => void,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  // 先等一小段时间让旧进程退出，避免立即探测到正在关闭的旧进程。
  await sleep(800);
  while (Date.now() < deadline) {
    attempt += 1;
    onProbe?.(attempt);
    try {
      const resp = await fetch(`${GATEWAY_URL}/health`, { credentials: "include" });
      if (resp.ok) return true;
    } catch {
      // 进程还没起来，继续轮询。
    }
    await sleep(500);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 类型守卫。 */
export function isGatewayControlApiError(
  err: unknown
): err is GatewayControlApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    "status" in err
  );
}
