/**
 * KStock 模型配置 API 客户端 —— 对接 KStock 自有的 /api/v1/kstock/models。
 *
 * 与 authClient.ts 共享 GATEWAY_URL、cookie/credentials 策略（经 gatewayUrl），
 * 但错误体系独立（模型配置不涉及认证错误码，统一归一为 ModelsApiError）。
 * 引擎原生 GET /api/models 只读且不返回 provider/endpoint/api_key，本客户端
 * 对接的 KStock 写入层补齐这些字段。
 */
import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";

/** 一条模型配置（对应后端 ModelItem）。api_key_env 是 $ENV 引用而非明文。 */
export interface ModelConfig {
  name: string;
  display_name: string | null;
  description: string | null;
  use: string;
  model: string;
  api_base: string | null;
  api_key_env: string | null;
  supports_thinking: boolean;
  supports_vision: boolean;
  supports_reasoning_effort: boolean;
}

/** 创建/编辑模型时的负载。api_key 留空（或 null）表示不修改现有 key。 */
export interface ModelWritePayload {
  name: string;
  display_name?: string | null;
  description?: string | null;
  use: string;
  model: string;
  api_base?: string | null;
  api_key?: string | null;
  supports_thinking?: boolean;
  supports_vision?: boolean;
  supports_reasoning_effort?: boolean;
}

/** listModels 响应。 */
export interface ModelsListResponse {
  models: ModelConfig[];
  default_model: string | null;
}

/** 模型配置操作归一化错误。 */
export interface ModelsApiError {
  message: string;
  status: number;
}

/**
 * 统一 fetch：自动 ``credentials: "include"``、JSON Content-Type、CSRF header，
 * 并把 gateway 的三种 detail 形态（对象 ``{message}`` / 裸字符串 / 校验数组）
 * 归一为 {@link ModelsApiError}。
 */
async function modelsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    response = await fetch(`${GATEWAY_URL}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw { message: "无法连接本地引擎，请确认 gateway 已启动", status: 0 } satisfies ModelsApiError;
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
    } else if (
      detail &&
      typeof detail === "object" &&
      "message" in detail
    ) {
      message = String((detail as { message: unknown }).message);
    } else {
      message = "操作失败，请稍后重试";
    }
    throw { message, status: response.status } satisfies ModelsApiError;
  }
  return body as T;
}

// ── API ─────────────────────────────────────────────────────────────

/** 读取全部模型配置与当前默认模型。 */
export function listModels(): Promise<ModelsListResponse> {
  return modelsFetch<ModelsListResponse>("/api/v1/kstock/models");
}

/** 新增模型；成功后 gateway 同步写 runtime.yaml + secrets.env。 */
export function createModel(payload: ModelWritePayload): Promise<ModelConfig> {
  return modelsFetch<ModelConfig>("/api/v1/kstock/models", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** 编辑现有模型；name 不可变更，api_key 留空表示不改现有 key。 */
export function updateModel(name: string, payload: ModelWritePayload): Promise<ModelConfig> {
  return modelsFetch<ModelConfig>(`/api/v1/kstock/models/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** 删除模型；同时清理 runtime.yaml 与 secrets.env 对应条目。 */
export async function deleteModel(name: string): Promise<void> {
  await modelsFetch<void>(`/api/v1/kstock/models/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

/** 读取 KStock 前端偏好中的默认模型（引擎无关）。 */
export function getDefaultModel(): Promise<{ default_model: string | null }> {
  return modelsFetch<{ default_model: string | null }>("/api/v1/kstock/default-model");
}

/** 设置默认模型偏好；传 null 清除。 */
export function setDefaultModel(
  name: string | null,
): Promise<{ default_model: string | null }> {
  return modelsFetch<{ default_model: string | null }>(
    "/api/v1/kstock/default-model",
    {
      method: "PUT",
      body: JSON.stringify({ default_model: name }),
    },
  );
}

/** 类型守卫：捕获的值是否为 ModelsApiError。 */
export function isModelsApiError(err: unknown): err is ModelsApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    "status" in err
  );
}
