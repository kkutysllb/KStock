// ── 记忆系统 API 客户端（对接引擎 /api/memory/*）──────────────────────────
//
// 后端能力（vendor/qilin/app/gateway/routers/memory.py，prefix=/api）：
//   GET    /memory           读取完整记忆（user/history 上下文 + facts[]）
//   POST   /memory/reload    从存储文件重新加载（刷新缓存）
//   DELETE /memory           清空所有记忆数据
//   POST   /memory/facts     新建 fact（content/category/confidence）
//   DELETE /memory/facts/{id} 删除单个 fact
//   PATCH  /memory/facts/{id} 局部更新 fact（省略字段保留原值）
//   GET    /memory/export    导出（同 GET /memory，用于备份）
//   POST   /memory/import    导入（覆盖当前记忆）
//   GET    /memory/config    读取记忆配置（enabled/mode/backend_config...）
//   GET    /memory/status    配置 + 数据合并返回
//
// 注意：GET /memory 在后端不支持完整 doc 时返回 501（minimal backend），
// 前端应优雅降级（只展示 config 部分）。facts CRUD 在不支持时返回 501。
//
// 与 modelsClient 共享 GATEWAY_URL/credentials/csrf 策略。

import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";

// ── 数据模型（与后端 Pydantic 对齐）──

export interface ContextSection {
  summary: string;
  updatedAt: string;
}

export interface UserContext {
  workContext?: ContextSection;
  personalContext?: ContextSection;
  topOfMind?: ContextSection;
}

export interface HistoryContext {
  recentMonths?: ContextSection;
  earlierContext?: ContextSection;
  longTermBackground?: ContextSection;
}

export interface MemoryFact {
  id: string;
  content: string;
  category: string;
  categoryExtension?: string | null;
  topics?: string[] | null;
  confidence: number;
  createdAt: string;
  source: string;
  sourceError?: string | null;
  schemaVersion?: number | null;
  status?: string | null;
  scope?: Record<string, string | null> | null;
  revision?: number | null;
  updatedAt?: string | null;
}

export interface MemoryData {
  version: string;
  revision?: number | null;
  lastUpdated: string;
  user?: UserContext;
  history?: HistoryContext;
  facts: MemoryFact[];
}

export type MemoryMode = "middleware" | "tool";

export interface MemoryConfig {
  enabled: boolean;
  mode: MemoryMode;
  injection_enabled: boolean;
  shutdown_flush_timeout_seconds: number;
  manager_class: string;
  backend_config: Record<string, unknown>;
}

export interface MemoryStatus {
  config: MemoryConfig;
  data: MemoryData;
}

// ── 错误归一 ──

export interface MemoryApiError {
  message: string;
  status: number;
}

/** 统一 fetch：credentials + JSON + CSRF，归一错误为 MemoryApiError。 */
async function memoryFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    throw { message: "无法连接本地引擎，请确认 gateway 已启动", status: 0 } satisfies MemoryApiError;
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
    } else if (detail && typeof detail === "object" && "message" in detail) {
      message = String((detail as { message: unknown }).message);
    } else {
      message = "操作失败，请稍后重试";
    }
    throw { message, status: response.status } satisfies MemoryApiError;
  }
  return body as T;
}

// ── API ─────────────────────────────────────────────────────────────

/** 读取完整记忆数据。后端不支持完整 doc 时抛 501 错误。 */
export function getMemory(): Promise<MemoryData> {
  return memoryFetch<MemoryData>("/api/memory");
}

/** 重新从存储文件加载记忆（刷新缓存）。 */
export function reloadMemory(): Promise<MemoryData> {
  return memoryFetch<MemoryData>("/api/memory/reload", { method: "POST" });
}

/** 清空所有记忆数据（不可恢复）。 */
export function clearMemory(): Promise<MemoryData> {
  return memoryFetch<MemoryData>("/api/memory", { method: "DELETE" });
}

/** 新建 fact。返回更新后的完整记忆。 */
export function createFact(payload: {
  content: string;
  category?: string;
  confidence?: number;
}): Promise<MemoryData> {
  return memoryFetch<MemoryData>("/api/memory/facts", {
    method: "POST",
    body: JSON.stringify({
      content: payload.content,
      category: payload.category ?? "context",
      confidence: payload.confidence ?? 0.5,
    }),
  });
}

/** 删除单个 fact。返回更新后的完整记忆。 */
export function deleteFact(factId: string): Promise<MemoryData> {
  return memoryFetch<MemoryData>(`/api/memory/facts/${encodeURIComponent(factId)}`, {
    method: "DELETE",
  });
}

/** 局部更新 fact（省略字段保留原值）。返回更新后的完整记忆。 */
export function patchFact(
  factId: string,
  patch: { content?: string; category?: string; confidence?: number }
): Promise<MemoryData> {
  return memoryFetch<MemoryData>(`/api/memory/facts/${encodeURIComponent(factId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** 导出记忆数据（用于备份）。 */
export function exportMemory(): Promise<MemoryData> {
  return memoryFetch<MemoryData>("/api/memory/export");
}

/** 导入记忆数据（覆盖当前）。 */
export function importMemory(data: MemoryData): Promise<MemoryData> {
  return memoryFetch<MemoryData>("/api/memory/import", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 读取记忆系统配置。 */
export function getMemoryConfig(): Promise<MemoryConfig> {
  return memoryFetch<MemoryConfig>("/api/memory/config");
}

/** 读取配置 + 数据合并状态。后端不支持完整 doc 时抛 501。 */
export function getMemoryStatus(): Promise<MemoryStatus> {
  return memoryFetch<MemoryStatus>("/api/memory/status");
}

/** 类型守卫。 */
export function isMemoryApiError(err: unknown): err is MemoryApiError {
  return typeof err === "object" && err !== null && "message" in err && "status" in err;
}
