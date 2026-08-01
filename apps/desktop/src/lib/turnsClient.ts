// ── 引擎对话/流式 API 客户端 ──────────────────────────────────────────
// 前端直连引擎网关（vendor/qilin/app/gateway）：
//   POST /api/threads                    — 创建 thread
//   POST /api/threads/search             — 搜索/列出当前用户的 thread
//   POST /api/threads/{id}/runs/stream             — SSE 流式 run
//   POST /api/threads/{id}/runs/{run_id}/cancel    — 取消 run（停止 agent + subagent）
//   GET  /api/threads/{id}/messages                — 历史消息（懒加载）
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
  /**
   * 从 metadata 帧捕获到 run_id 时调用（在第一帧前后发出）。
   *
   * 调用方拿到 run_id 后可用于显式 cancel（POST .../runs/{run_id}/cancel），
   * 避免 abort SSE 后依赖后端断连检测的延迟。可能被调用多次（如重连），
   * 调用方应幂等处理。
   */
  onRunId?: (runId: string) => void;
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
      // metadata 帧携带 run_id（实测协议：event: metadata / data: {"run_id":"..."}）。
      // 提前回调 onRunId，供调用方在需要时显式 cancel（不等断连检测延迟）。
      if (frame.event === "metadata" && frame.data && typeof frame.data === "object") {
        const rid = (frame.data as Record<string, unknown>).run_id;
        if (typeof rid === "string" && rid) {
          handlers.onRunId?.(rid);
        }
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
 * 显式取消 run（停止 agent + subagent 执行）。
 *
 * 后端：POST /api/threads/{thread_id}/runs/{run_id}/cancel?action=interrupt，
 * 需 owner 权限。action=interrupt 保留当前 checkpoint（可恢复），不回滚。
 * 成功返回 202（异步取消）或 204（wait=true 且 run 已停止）；失败抛错。
 *
 * 与 abort SSE 连接的区别：
 * - abort 只断开前端 fetch，依赖后端 on_disconnect=cancel 检测（有 heartbeat 延迟）
 * - cancelRun 直接通知后端 RunManager 取消，即时性更高
 * 推荐两者同时使用（cancelRun 先发，abort 断流兼兜底）。
 */
export async function cancelRun(threadId: string, runId: string): Promise<void> {
  const resp = await fetch(
    `${GATEWAY_URL}/api/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}/cancel?action=interrupt`,
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders()
    }
  );
  if (!resp.ok) {
    throw await toError("取消 run 失败", resp);
  }
  // best-effort 消费 body（202/204 均无关键 payload）
  try {
    await resp.text();
  } catch {
    /* ignore */
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

/** 单个 thread 的精简信息（从 POST /api/threads/search 返回）。 */
export interface ThreadSummary {
  thread_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  values: Record<string, unknown>;
}

/**
 * 列出当前用户的全部历史 thread。
 *
 * 后端：POST /api/threads/search，需登录（根据 cookie 里 user 自动过滤）。
 * 返回按 updated_at 倒序（后端默认行为）的 thread 列表；未登录或无 thread 返回空数组。
 */
export async function listThreads(limit = 100): Promise<ThreadSummary[]> {
  let resp: Response;
  try {
    resp = await fetch(`${GATEWAY_URL}/api/threads/search`, {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders(),
      body: JSON.stringify({ limit, offset: 0 })
    });
  } catch {
    return [];
  }
  if (!resp.ok) {
    // 401/403 或 gateway 未启动时返回空，不打断启动流程
    return [];
  }
  try {
    const data = (await resp.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data as ThreadSummary[];
  } catch {
    return [];
  }
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
