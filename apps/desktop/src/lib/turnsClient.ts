// ── 引擎对话/流式 API 客户端 ──────────────────────────────────────────
// 前端直连引擎网关（vendor/qilin/app/gateway）：
//   POST /api/threads                    — 创建 thread
//   POST /api/threads/{id}/runs/stream   — SSE 流式 run
//   GET  /api/threads/{id}/messages      — 历史消息（懒加载）
//
// CSRF: Double Submit Cookie（cookie csrf_token + header X-CSRF-Token）。
// 实测确认带 header 的 fetch POST 能通过 csrf_middleware（非 EventSource）。

import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";
import { parseSseStream, type SseFrame } from "./sseParser";

/** 注入 RunCreateRequest.context 的模型运行参数。 */
export interface RunContext {
  model_name: string;
  thinking_enabled: boolean;
  reasoning_effort?: string;
}

export interface StreamRunHandlers {
  /** 每收到一帧 SSE 调用（交给 turnReducer 更新 turn 状态）。 */
  onFrame: (frame: SseFrame) => void;
  /** 网络/HTTP 错误或 event:error 帧时调用。 */
  onError: (error: Error) => void;
}

export interface StreamRunOptions {
  threadId: string;
  input: { messages: Array<{ role: "user"; content: string }> };
  context: RunContext;
  signal?: AbortSignal;
  handlers: StreamRunHandlers;
}

/** 创建引擎 thread，返回 thread_id。 */
export async function ensureThread(): Promise<string> {
  const resp = await fetch(`${GATEWAY_URL}/api/threads`, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders(),
    body: "{}"
  });
  if (!resp.ok) {
    throw await toError("创建 thread 失败", resp);
  }
  const data = (await resp.json()) as { thread_id?: string };
  if (!data.thread_id) {
    throw new Error("创建 thread 失败：响应缺少 thread_id");
  }
  return data.thread_id;
}

/**
 * 删除引擎 thread（同步清理用户数据空间下整个 thread 目录：
 * workspace/uploads/outputs/中间文件 + checkpoints + thread_meta）。
 *
 * 后端：DELETE /api/threads/{thread_id}，需 owner 权限。
 * 返回 { success, message }；失败抛错。
 */
export async function deleteThread(threadId: string): Promise<void> {
  const resp = await fetch(`${GATEWAY_URL}/api/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
    credentials: "include",
    headers: jsonHeaders()
  });
  if (!resp.ok) {
    throw await toError("删除 thread 失败", resp);
  }
  // HTTP 2xx 即成功。后端返回 { success, message }，best-effort 消费 body
  // （空 body 或非 JSON 不影响判定）。
  try {
    await resp.text();
  } catch {
    /* ignore */
  }
}

/**
 * 发起流式 run，逐帧回调 handlers.onFrame，直至 event:end 或流结束。
 * 遇 event:error / HTTP 非 2xx / 网络错误调 handlers.onError。
 * signal abort 时静默终止（不报错）。
 */
export async function streamRun(opts: StreamRunOptions): Promise<void> {
  const { threadId, input, context, signal, handlers } = opts;
  let resp: Response;
  try {
    resp = await fetch(`${GATEWAY_URL}/api/threads/${threadId}/runs/stream`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...jsonHeaders(),
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        input,
        context,
        stream_mode: ["values", "messages-tuple", "custom"]
      }),
      signal
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }

  if (!resp.ok || !resp.body) {
    handlers.onError(await toError("发起 run 失败", resp));
    return;
  }

  try {
    for await (const frame of parseSseStream(resp.body)) {
      if (signal?.aborted) return;
      if (frame.event === "error") {
        const msg = typeof frame.data === "string" ? frame.data : "引擎 run 报错";
        handlers.onError(new Error(msg));
        return;
      }
      handlers.onFrame(frame);
      if (frame.event === "end") return;
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * 拉取 thread 历史消息（切回旧 session 时懒加载）。
 * 返回引擎原始 messages 数组；Task 9 写转换为 ChatMessage[]。
 */
export async function fetchThreadMessages(threadId: string): Promise<unknown[]> {
  const resp = await fetch(`${GATEWAY_URL}/api/threads/${threadId}/messages`, {
    method: "GET",
    credentials: "include",
    headers: jsonHeaders()
  });
  if (!resp.ok) {
    throw await toError("拉取历史消息失败", resp);
  }
  const data = (await resp.json()) as unknown;
  // 引擎返回 { messages: [...] } 或直接 [...]；兼容两种形态
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).messages)) {
    return (data as { messages: unknown[] }).messages;
  }
  return [];
}

/** 把模型选择 + 能力位映射为 RunContext。 */
export function runContextFromModel(
  model: { name: string; supports_thinking: boolean; supports_reasoning_effort?: boolean },
  reasoningEffort?: string
): RunContext {
  const ctx: RunContext = {
    model_name: model.name,
    thinking_enabled: model.supports_thinking
  };
  if (model.supports_reasoning_effort && reasoningEffort) {
    ctx.reasoning_effort = reasoningEffort;
  }
  return ctx;
}

// ── 内部工具 ──
function jsonHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const csrf = readCsrfToken();
  if (csrf) h["X-CSRF-Token"] = csrf;
  return h;
}

async function toError(prefix: string, resp: Response): Promise<Error> {
  let detail = "";
  try {
    const body = await resp.json();
    detail = (body as { detail?: string }).detail ?? JSON.stringify(body);
  } catch {
    try {
      detail = await resp.text();
    } catch {
      /* ignore */
    }
  }
  const msg = detail ? `${prefix}（${resp.status}）：${detail}` : `${prefix}（${resp.status}）`;
  return new Error(msg);
}
