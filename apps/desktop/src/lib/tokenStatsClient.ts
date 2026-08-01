import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";

export interface TokenStatsDay {
  date: string;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  runs: number;
  completed_tasks: number;
  api_calls: number;
  cache_read_tokens: number;
}

export interface TokenStatsResponse {
  days: TokenStatsDay[];
  total_tokens: number;
  total_runs: number;
  completed_tasks: number;
  api_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_hit_rate: number;
}

export interface TokenStatsApiError {
  message: string;
  status: number;
}

export function isTokenStatsApiError(error: unknown): error is TokenStatsApiError {
  return Boolean(error && typeof error === "object" && "message" in error && "status" in error);
}

export async function getTokenStats(days = 30): Promise<TokenStatsResponse> {
  const tzOffsetMinutes = -new Date().getTimezoneOffset();
  const headers = new Headers();
  const csrf = readCsrfToken();
  if (csrf) headers.set("X-CSRF-Token", csrf);

  let response: Response;
  try {
    response = await fetch(
      `${GATEWAY_URL}/api/console/usage?days=${days}&tz_offset_minutes=${tzOffsetMinutes}`,
      { headers, credentials: "include" },
    );
  } catch {
    throw { message: "无法连接本地引擎，请确认 gateway 已启动", status: 0 } satisfies TokenStatsApiError;
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
    const message = typeof detail === "string"
      ? detail
      : response.status === 401
        ? "请先登录后查看 Token 统计"
        : response.status === 503
          ? "当前数据存储未启用历史统计"
          : "Token 统计加载失败，请稍后重试";
    throw { message, status: response.status } satisfies TokenStatsApiError;
  }
  return body as TokenStatsResponse;
}
