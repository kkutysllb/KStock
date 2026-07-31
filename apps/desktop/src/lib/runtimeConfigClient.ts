// ── 运行时配置 API 客户端（对接 KStock 自有 /api/v1/kstock/runtime-config）──
//
// 持久化真源是 <数据根>/config/qilin.runtime.yaml（引擎 mtime 热重载）。
// 本端点读写 memory / summarization / title / database 四段，保留其他段。
//
// 与 memoryClient.ts 的区别：
//   memoryClient → /api/memory/* 引擎只读 API（读取热重载后的生效单例值）
//   runtimeConfigClient → /api/v1/kstock/runtime-config KStock 读写 API（读写 yaml 文件内容）

import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";

// ── 数据模型（与后端 pydantic 对齐）──

export type ContextSizeType = "fraction" | "tokens" | "messages";

export interface ContextSize {
  type: ContextSizeType;
  value: number;
}

export interface SummarizationConfig {
  enabled: boolean;
  model_name: string | null;
  trigger: ContextSize | ContextSize[] | null;
  keep: ContextSize;
  trim_tokens_to_summarize: number | null;
  summary_prompt: string | null;
  skill_file_read_tool_names: string[];
}

export interface TitleConfig {
  enabled: boolean;
  max_words: number;
  max_chars: number;
  model_name: string | null;
  prompt_template?: string;
}

export interface MemoryRuntimeConfig {
  enabled: boolean;
  mode: "middleware" | "tool";
  injection_enabled: boolean;
  shutdown_flush_timeout_seconds: number;
  manager_class: string;
  backend_config: Record<string, unknown>;
}

export interface DatabaseConfig {
  backend: "memory" | "sqlite" | "postgres";
  sqlite_dir: string;
  postgres_url: string;
  echo_sql: boolean;
  pool_size: number;
  pool_recycle: number;
  command_timeout: number | null;
  checkpoint_channel_mode: "full" | "delta";
  checkpoint_delta: { snapshot_frequency: number };
  checkpoint_graph_cache: { accessor_graph_max: number };
}

export interface RuntimeConfig {
  memory: MemoryRuntimeConfig;
  summarization: SummarizationConfig;
  title: TitleConfig;
  database: DatabaseConfig;
}

export type RuntimeConfigSection = keyof RuntimeConfig;

// ── 错误归一 ──

export interface RuntimeConfigApiError {
  message: string;
  status: number;
  /** 校验失败时的字段级错误明细（status=400 时才有） */
  fieldErrors?: Array<{ field: string; message: string; type: string }>;
}

async function runtimeConfigFetch<T>(
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
    } satisfies RuntimeConfigApiError;
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
    let fieldErrors: RuntimeConfigApiError["fieldErrors"];
    if (typeof detail === "string") {
      message = detail;
    } else if (detail && typeof detail === "object") {
      const d = detail as Record<string, unknown>;
      message = typeof d.message === "string" ? d.message : "配置校验失败";
      if (Array.isArray(d.errors)) {
        fieldErrors = (d.errors as Array<Record<string, unknown>>).map((e) => ({
          field: String(e.field ?? ""),
          message: String(e.message ?? ""),
          type: String(e.type ?? ""),
        }));
      }
    } else {
      message = "操作失败，请稍后重试";
    }
    throw { message, status: response.status, fieldErrors } satisfies RuntimeConfigApiError;
  }
  return body as T;
}

// ── API ─────────────────────────────────────────────────────────────

/** 读取 runtime.yaml 的四段配置。段缺失时后端返回 pydantic 默认值。 */
export function getRuntimeConfig(): Promise<RuntimeConfig> {
  return runtimeConfigFetch<RuntimeConfig>("/api/v1/kstock/runtime-config");
}

/** 更新单个配置段。后端 pydantic 校验，失败抛 400 + fieldErrors。 */
export function updateRuntimeConfigSection<S extends RuntimeConfigSection>(
  section: S,
  value: RuntimeConfig[S]
): Promise<{ section: S; value: RuntimeConfig[S] }> {
  return runtimeConfigFetch<{ section: S; value: RuntimeConfig[S] }>(
    `/api/v1/kstock/runtime-config/${encodeURIComponent(section)}`,
    { method: "PUT", body: JSON.stringify(value) }
  );
}

/** 类型守卫。 */
export function isRuntimeConfigApiError(
  err: unknown
): err is RuntimeConfigApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    "status" in err
  );
}
