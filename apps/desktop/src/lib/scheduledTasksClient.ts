/**
 * 引擎 scheduled-tasks API 客户端（定时任务：周报等周期性自动研究）。
 *
 * 任务到期由 gateway 内置 scheduler 后台拉起 run（无 SSE 消费者，结果
 * 落库）；桌面端负责创建/管理任务，并轮询 last_run 状态变化发通知。
 */

import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";

export interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  schedule_type: "once" | "cron";
  schedule_spec: { cron?: string; run_at?: string };
  timezone: string;
  context_mode: "fresh_thread_per_run" | "reuse_thread";
  status: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_run_id?: string | null;
  last_thread_id?: string | null;
  last_error?: string | null;
  run_count?: number;
}

export interface ScheduledTaskRun {
  id: string;
  task_id: string;
  thread_id?: string | null;
  run_id?: string | null;
  status: string;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface ScheduledTaskApiError {
  message: string;
  status: number;
}

export function isScheduledTaskApiError(error: unknown): error is ScheduledTaskApiError {
  return Boolean(error && typeof error === "object" && "message" in error && "status" in error);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
    const csrf = readCsrfToken();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // 非 JSON 错误体，保留默认消息。
    }
    const error: ScheduledTaskApiError = { message, status: response.status };
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function listScheduledTasks(): Promise<ScheduledTask[]> {
  return request<ScheduledTask[]>("/api/scheduled-tasks");
}

export interface CreateScheduledTaskInput {
  title: string;
  prompt: string;
  cron: string;
  timezone?: string;
  context_mode?: "fresh_thread_per_run" | "reuse_thread";
}

export function createScheduledTask(input: CreateScheduledTaskInput): Promise<ScheduledTask> {
  return request<ScheduledTask>("/api/scheduled-tasks", {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      prompt: input.prompt,
      schedule_type: "cron",
      schedule_spec: { cron: input.cron },
      timezone: input.timezone ?? "Asia/Shanghai",
      context_mode: input.context_mode ?? "fresh_thread_per_run",
    }),
  });
}

export function pauseScheduledTask(taskId: string): Promise<unknown> {
  return request(`/api/scheduled-tasks/${encodeURIComponent(taskId)}/pause`, { method: "POST" });
}

export function resumeScheduledTask(taskId: string): Promise<unknown> {
  return request(`/api/scheduled-tasks/${encodeURIComponent(taskId)}/resume`, { method: "POST" });
}

export function deleteScheduledTask(taskId: string): Promise<unknown> {
  return request(`/api/scheduled-tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
}

export function listScheduledTaskRuns(taskId: string, limit = 10): Promise<ScheduledTaskRun[]> {
  return request<ScheduledTaskRun[]>(
    `/api/scheduled-tasks/${encodeURIComponent(taskId)}/runs?limit=${limit}`,
  );
}
