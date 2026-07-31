// ── MCP 扩展配置 API 客户端（对接 /api/v1/kstock/extensions）──
//
// 持久化真源是 <数据根>/config/extensions_config.json。
// 与 runtimeConfigClient.ts 共享 GATEWAY_URL + CSRF + 错误归一逻辑。

import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";

// ── 数据模型（与后端 McpServerPayload 对齐）──

export type McpTransportType = "stdio" | "sse" | "http";

export interface McpServerConfig {
  enabled: boolean;
  type: McpTransportType;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  headers: Record<string, string>;
  description: string;
  tool_call_timeout: number | null;
}

export interface ExtensionsConfig {
  middlewares: string[];
  mcpServers: Record<string, McpServerConfig>;
  skills: Record<string, { enabled: boolean }>;
}

// ── 错误归一 ──

export interface ExtensionsApiError {
  message: string;
  status: number;
}

export function isExtensionsApiError(e: unknown): e is ExtensionsApiError {
  return typeof e === "object" && e !== null && "message" in e && "status" in e;
}

async function extensionsFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const csrf = readCsrfToken();
  if (csrf && !headers.has("X-CSRF-Token")) {
    headers.set("X-CSRF-Token", csrf);
  }
  let response: Response;
  try {
    response = await fetch(`${GATEWAY_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw {
      message: "无法连接本地引擎，请确认 gateway 已启动",
      status: 0,
    } satisfies ExtensionsApiError;
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
      message =
        typeof (detail as Record<string, unknown>).message === "string"
          ? (detail as Record<string, string>).message
          : "操作失败";
    } else {
      message = `操作失败（HTTP ${response.status}）`;
    }
    throw { message, status: response.status } satisfies ExtensionsApiError;
  }
  return (body ?? {}) as T;
}

// ── API 函数 ──

export function getExtensions(): Promise<ExtensionsConfig> {
  return extensionsFetch<ExtensionsConfig>("/api/v1/kstock/extensions");
}

export async function createMcpServer(
  name: string,
  config: McpServerConfig
): Promise<{ name: string; action: string }> {
  const resp = await extensionsFetch<{ name: string; action: string }>(
    `/api/v1/kstock/extensions/mcp-servers/${encodeURIComponent(name)}`,
    { method: "POST", body: JSON.stringify(config) }
  );
  return resp;
}

export async function updateMcpServer(
  name: string,
  config: McpServerConfig
): Promise<{ name: string; action: string }> {
  const resp = await extensionsFetch<{ name: string; action: string }>(
    `/api/v1/kstock/extensions/mcp-servers/${encodeURIComponent(name)}`,
    { method: "PUT", body: JSON.stringify(config) }
  );
  return resp;
}

export async function deleteMcpServer(
  name: string
): Promise<{ name: string; action: string }> {
  const resp = await extensionsFetch<{ name: string; action: string }>(
    `/api/v1/kstock/extensions/mcp-servers/${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
  return resp;
}
