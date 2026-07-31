// ── gateway 进程控制 API 客户端（对接 /api/v1/kstock/restart）──
//
// gateway 是独立 uvicorn 进程，重启依赖 supervisor 模式（见
// scripts/run_gateway.py 的 _run_supervisor）。本模块提供 restart 请求 +
// 健康轮询恢复探测（gateway 重启后端口短暂不可用，需轮询 /health 感知恢复）。

import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";

/** gateway 进程控制错误（归一化）。 */
export interface GatewayControlApiError {
  message: string;
  status: number;
}

/** restart 响应。supervised=false 表示当前非 supervisor 模式（不会真的重启）。 */
export interface RestartResult {
  message: string;
  supervised: boolean;
}

/**
 * 请求 gateway 重启。
 *
 * 后端在 supervisor 模式下会延迟 0.5s 后以 RESTART_EXIT_CODE 退出，supervisor
 * 检测到后自动重启子进程；非 supervisor 模式返回 503 提示手动重启。
 */
export async function restartGateway(): Promise<RestartResult> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const csrf = readCsrfToken();
  if (csrf) headers.set("X-CSRF-Token", csrf);

  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}/api/v1/kstock/restart`, {
      method: "POST",
      headers,
      credentials: "include",
    });
  } catch {
    // fetch 抛错通常是进程已退出（端口不可达）——对重启场景反而是预期信号。
    // 等待恢复轮询会感知新进程上线，这里不阻断流程。
    throw { message: "后端进程未响应，将等待恢复", status: 0 } satisfies GatewayControlApiError;
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { detail: text };
    }
  }

  if (!response.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    let message: string;
    if (typeof detail === "string") {
      message = detail;
    } else if (detail && typeof detail === "object") {
      message = String((detail as Record<string, unknown>).message ?? "重启失败");
    } else {
      message = "重启失败，请稍后重试";
    }
    throw { message, status: response.status } satisfies GatewayControlApiError;
  }
  return body as RestartResult;
}

/**
 * 轮询 gateway ``/health`` 直到恢复或超时。
 *
 * gateway 重启后端口短暂不可用（旧进程退出 → supervisor 重启子进程 → 新进程
 * listen），前端用固定间隔轮询 ``/health``（CSRF 豁免、无需认证）感知恢复。
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
