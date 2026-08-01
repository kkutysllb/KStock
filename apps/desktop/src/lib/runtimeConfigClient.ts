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

export interface SandboxConfig {
  use: string;
  allow_host_bash: boolean;
  bash_command_timeout: number;
  bash_output_max_chars: number;
  read_file_output_max_chars: number;
  ls_output_max_chars: number;
}

export interface TokenUsageConfig {
  enabled: boolean;
}

export interface TokenBudgetConfig {
  enabled: boolean;
  max_tokens: number;
  max_input_tokens: number | null;
  max_output_tokens: number | null;
  warn_threshold: number;
  hard_stop_threshold: number;
}

// ── 权限与护栏 ──

export interface GuardrailsConfig {
  enabled: boolean;
  fail_closed: boolean;
  passport: string | null;
  provider: { use: string; config: Record<string, unknown> } | null;
}

export interface AuthorizationConfig {
  enabled: boolean;
  fail_closed: boolean;
  default_role: string;
  provider: { use: string; config: Record<string, unknown> } | null;
}

export interface InputPolishConfig {
  enabled: boolean;
  max_chars: number;
  model_name: string | null;
}

export interface LoopDetectionConfig {
  enabled: boolean;
  warn_threshold: number;
  hard_limit: number;
  window_size: number;
  max_tracked_threads: number;
  tool_freq_warn: number;
  tool_freq_hard_limit: number;
  tool_freq_overrides: Record<string, { warn: number; hard_limit: number }>;
}

export interface SafetyFinishReasonConfig {
  enabled: boolean;
  detectors: Array<{ use: string; config: Record<string, unknown> }> | null;
}

// ── 搜索与来源 ──

export interface ToolSearchConfig {
  enabled: boolean;
  auto_promote_top_k: number;
}

// ── 智能体 ──

/** 用户自定义子代理角色（对应引擎 CustomSubagentConfig）。 */
export interface CustomSubagentConfig {
  description: string;
  system_prompt: string;
  /** 工具白名单，null = 继承父代理全部工具 */
  tools: string[] | null;
  /** 工具黑名单（默认含 task / ask_clarification / present_files） */
  disallowed_tools: string[] | null;
  /** 技能白名单，null = 继承全部启用技能，[] = 无技能 */
  skills: string[] | null;
  /** 模型名，'inherit' = 继承父代理模型 */
  model: string;
  max_turns: number;
  timeout_seconds: number;
}

/** 子代理全局配置段（对应引擎 SubagentsAppConfig，不含 token_budget 私有字段）。 */
export interface SubagentsConfig {
  timeout_seconds: number;
  max_turns: number | null;
  max_total_per_run: number;
  token_budget: TokenBudgetConfig;
  agents: Record<string, unknown>;
  custom_agents: Record<string, CustomSubagentConfig>;
}

/** 附件上传限制段（对应 scripts/kstock_uploads_config:UploadsUserConfig）。size 字段以字节为单位。 */
export interface UploadsConfig {
  max_files: number;
  max_file_size: number;
  max_total_size: number;
  /** 上传时自动把 PDF/docx 等文档转成 markdown，让 agent 可用 read_file 直接读取。 */
  auto_convert_documents: boolean;
}

export interface RuntimeConfig {
  memory: MemoryRuntimeConfig;
  summarization: SummarizationConfig;
  title: TitleConfig;
  database: DatabaseConfig;
  sandbox: SandboxConfig;
  token_usage: TokenUsageConfig;
  token_budget: TokenBudgetConfig;
  // 权限与护栏
  guardrails: GuardrailsConfig;
  authorization: AuthorizationConfig;
  input_polish: InputPolishConfig;
  loop_detection: LoopDetectionConfig;
  safety_finish_reason: SafetyFinishReasonConfig;
  // 搜索与来源
  tool_search: ToolSearchConfig;
  // 智能体
  subagents: SubagentsConfig;
  // 附件上传（KStock 自定义段）
  uploads: UploadsConfig;
  // 顶层标量字段
  max_recursion_limit: number;
}

/** 可编辑的配置段（dict 值，走 updateRuntimeConfigSection）。 */
export type RuntimeConfigSection =
  | "memory"
  | "summarization"
  | "title"
  | "database"
  | "sandbox"
  | "token_usage"
  | "token_budget"
  | "guardrails"
  | "authorization"
  | "input_polish"
  | "loop_detection"
  | "safety_finish_reason"
  | "tool_search"
  | "subagents"
  | "uploads";

/** 顶层标量字段名（走 updateTopLevelField）。 */
export type RuntimeTopLevelField = "max_recursion_limit";

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

/** 读取 runtime.yaml 的所有配置段 + 顶层字段。段缺失时后端返回默认值。 */
export function getRuntimeConfig(): Promise<RuntimeConfig> {
  return runtimeConfigFetch<RuntimeConfig>("/api/v1/kstock/runtime-config");
}

/** 更新单个配置段（dict 值）。后端 pydantic 校验，失败抛 400 + fieldErrors。 */
export function updateRuntimeConfigSection<S extends RuntimeConfigSection>(
  section: S,
  value: Record<string, unknown>
): Promise<{ section: S; value: Record<string, unknown> }> {
  return runtimeConfigFetch<{ section: S; value: Record<string, unknown> }>(
    `/api/v1/kstock/runtime-config/${encodeURIComponent(section)}`,
    { method: "PUT", body: JSON.stringify(value) }
  );
}

/** 更新顶层标量字段（max_recursion_limit）。body 为 {field: value}。 */
export function updateTopLevelField(
  field: RuntimeTopLevelField,
  value: number
): Promise<{ section: string; value: Record<string, unknown> }> {
  return runtimeConfigFetch<{ section: string; value: Record<string, unknown> }>(
    `/api/v1/kstock/runtime-config/${encodeURIComponent(field)}`,
    { method: "PUT", body: JSON.stringify({ [field]: value }) }
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
