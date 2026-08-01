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

// ── Skills 启停 API ──

/** 单个预置技能的展示信息 + 启用状态。 */
export interface SkillInfo {
  name: string;
  dir_name: string;
  group: string;
  path: string;
  title: string;
  description: string;
  version: string;
  category: string;
  enabled: boolean;
}

/** GET /available-skills 响应。 */
export interface AvailableSkillsResponse {
  skills: SkillInfo[];
}

/** PUT /skills/{name} 的 payload。 */
export interface SkillStatePayload {
  enabled: boolean;
}

/** PUT/DELETE /skills/{name} 的响应。 */
export interface SkillActionResponse {
  name: string;
  enabled: boolean;
  action: string;
}

export function getAvailableSkills(): Promise<AvailableSkillsResponse> {
  return extensionsFetch<AvailableSkillsResponse>(
    "/api/v1/kstock/extensions/available-skills"
  );
}

export async function setSkillEnabled(
  name: string,
  enabled: boolean
): Promise<SkillActionResponse> {
  return extensionsFetch<SkillActionResponse>(
    `/api/v1/kstock/extensions/skills/${encodeURIComponent(name)}`,
    { method: "PUT", body: JSON.stringify({ enabled } satisfies SkillStatePayload) }
  );
}

export async function deleteSkillState(
  name: string
): Promise<SkillActionResponse> {
  return extensionsFetch<SkillActionResponse>(
    `/api/v1/kstock/extensions/skills/${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
}

// ── MCP 模板（股票类预置 server）──

/** MCP server 模板定义。选中后预填 command/args/env，用户仍可编辑。 */
export interface McpServerTemplate {
  id: string;
  label: string;
  name: string;
  description: string;
  config: McpServerConfig;
  /** 用户需自行安装/配置的提示 */
  notice: string;
}

/**
 * 股票类 MCP server 模板。
 *
 * 注意：这些模板里的 command/args 是占位参考，对应的 MCP server 包可能
 * 尚未发布或名称不同。用户需自行安装对应 MCP server 并确认启动命令。
 */
export const MCP_SERVER_TEMPLATES: McpServerTemplate[] = [
  {
    id: "tushare",
    label: "Tushare 数据",
    name: "tushare-mcp",
    description: "Tushare Pro 金融数据（A股日线/财务/指数）",
    config: {
      enabled: true,
      type: "stdio",
      command: "npx",
      args: ["-y", "@tushare/mcp-server"],
      env: { TUSHARE_TOKEN: "填入你的 Tushare Pro token" },
      url: null,
      headers: {},
      description: "Tushare Pro 金融数据接口",
      tool_call_timeout: 60,
    },
    notice: "需在 Tushare Pro 官网注册获取 token，填入 TUSHARE_TOKEN 环境变量。",
  },
  {
    id: "akshare",
    label: "AKShare 数据",
    name: "akshare-mcp",
    description: "AKShare 开源金融数据（A股/港股/期货/宏观）",
    config: {
      enabled: true,
      type: "stdio",
      command: "python",
      args: ["-m", "akshare_mcp_server"],
      env: {},
      url: null,
      headers: {},
      description: "AKShare 开源金融数据",
      tool_call_timeout: 60,
    },
    notice: "需先 pip install akshare akshare-mcp-server，免费无限制。",
  },
  {
    id: "wind",
    label: "Wind 万得",
    name: "wind-mcp",
    description: "Wind 终端数据接口（需 Wind 客户端运行）",
    config: {
      enabled: true,
      type: "http",
      command: null,
      args: [],
      env: {},
      url: "http://localhost:8080/mcp",
      headers: { Authorization: "Bearer 填入你的 Wind API key" },
      description: "Wind 万得终端数据",
      tool_call_timeout: 30,
    },
    notice: "需 Wind 终端运行 + 启用 Wind API 服务。url 指向本地代理端口。",
  },
  {
    id: "choices",
    label: "Choice 东方财富",
    name: "choice-mcp",
    description: "Choice 金融终端数据（东方财富）",
    config: {
      enabled: true,
      type: "http",
      command: null,
      args: [],
      env: {},
      url: "http://localhost:8898/mcp",
      headers: {},
      description: "Choice 金融终端数据",
      tool_call_timeout: 30,
    },
    notice: "需 Choice 终端运行 + 启用 EMS API。url 指向本地代理端口。",
  },
];
