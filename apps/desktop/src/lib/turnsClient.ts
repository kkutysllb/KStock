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
  reasoning_effort?: ReasoningEffort;
  /** 开启子代理委派（lead agent 可并行分派 custom_agents）。 */
  subagent_enabled?: boolean;
}

/** 输入框推理菜单的运行级覆盖。auto 不覆盖模型默认能力。 */
export type ReasoningMode = "auto" | "off" | ReasoningEffort;
export type ReasoningEffort = "low" | "medium" | "high";

/**
 * 附件描述符（引擎 UploadedFileInfo 的必需字段子集）。
 *
 * 发送消息时放入 message.additional_kwargs.files，UploadsMiddleware 读取后
 * 注入 `<current_uploads>` 块让模型感知本轮上传。middleware 实际只读
 * filename/size（path/extension 自行重算），这里保留 virtual_path/artifact_url
 * 供前端展示与下载链接。
 */
export interface UploadedFileRef {
  filename: string;
  size: number;
  virtual_path: string;
  artifact_url: string;
  original_filename?: string;
  extension?: string;
  markdown_file?: string;
  markdown_artifact_url?: string;
}

export interface WorkspaceChangeFile {
  path: string;
  root?: string;
  status: "created" | "modified" | "deleted" | "symlink_created" | string;
  size_before?: number | null;
  size_after?: number | null;
  binary?: boolean;
  sensitive?: boolean;
}

export interface WorkspaceChangesResponse {
  available: boolean;
  files: WorkspaceChangeFile[];
  summary?: {
    created?: number;
    modified?: number;
    deleted?: number;
    symlink_created?: number;
  };
}

/** 引擎上传限制（max_file_size / max_total_size 以字节为单位）。 */
export interface UploadLimits {
  max_files: number;
  max_file_size: number;
  max_total_size: number;
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
  input: {
    messages: Array<{
      role: "user";
      content: string;
      /** 本轮上传的附件描述符；由 UploadsMiddleware 注入 <current_uploads> 块。 */
      additional_kwargs?: { files?: UploadedFileRef[] };
    }>;
  };
  context: RunContext;
  /**
   * 透传给 RunCreateRequest.config 的图运行参数；未提供时默认
   * { recursion_limit: 1000 }（引擎默认 100、runtime 上限 1000，
   * 多子代理/多轮工具迭代的复杂任务实测需 500+）。
   */
  config?: Record<string, unknown>;
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
        config: { recursion_limit: 1000, ...(opts.config ?? {}) },
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
  mode: ReasoningMode = "auto"
): RunContext {
  const ctx: RunContext = {
    model_name: model.name,
    thinking_enabled: mode === "off" ? false : model.supports_thinking,
    // 子代理是既定核心能力（lead agent 可并行委派 custom_agents），默认开启
    subagent_enabled: true
  };
  if (
    model.supports_thinking &&
    model.supports_reasoning_effort &&
    mode !== "auto" &&
    mode !== "off"
  ) {
    ctx.reasoning_effort = mode;
  }
  return ctx;
}

// ── 附件上传 ─────────────────────────────────────────────────────────
//
// 引擎 uploads router（vendor/qilin/app/gateway/routers/uploads.py）：
//   POST   /api/threads/{tid}/uploads            — multipart 上传（字段名 files）
//   GET    /api/threads/{tid}/uploads/limits     — 限制（max_files/max_file_size/max_total_size）
//   GET    /api/threads/{tid}/uploads/list       — 已上传文件列表
//   DELETE /api/threads/{tid}/uploads/{filename} — 删除单个附件

/**
 * 上传附件到 thread，返回成功落盘的文件描述符列表（可直接放入
 * message.additional_kwargs.files 一并发送）。
 *
 * 注意：multipart 请求不能手动设 Content-Type，浏览器会自动附加 boundary；
 * 这里用 csrfHeaders() 只带 CSRF token。若部分文件被引擎跳过（不安全文件名
 * 等），返回数组只含成功上传的项；全部失败时抛错。
 */
export async function uploadFiles(
  threadId: string,
  fileList: FileList | File[]
): Promise<UploadedFileRef[]> {
  const files = Array.from(fileList);
  if (!files.length) return [];
  const form = new FormData();
  for (const f of files) {
    form.append("files", f, f.name);
  }
  const resp = await fetch(
    `${GATEWAY_URL}/api/threads/${encodeURIComponent(threadId)}/uploads`,
    {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
      body: form
    }
  );
  if (!resp.ok) {
    throw await toError("上传附件失败", resp);
  }
  const data = (await resp.json()) as {
    success: boolean;
    files: Record<string, unknown>[];
    message: string;
    skipped_files?: string[];
  };
  if (!data.files || data.files.length === 0) {
    throw new Error(data.message || "上传失败");
  }
  return data.files.map(toFileRef);
}

/** 读取 thread 的上传限制（字节单位）。 */
export async function getUploadLimits(threadId: string): Promise<UploadLimits> {
  const resp = await fetch(
    `${GATEWAY_URL}/api/threads/${encodeURIComponent(threadId)}/uploads/limits`,
    { method: "GET", credentials: "include", headers: jsonHeaders() }
  );
  if (!resp.ok) {
    throw await toError("读取上传限制失败", resp);
  }
  return (await resp.json()) as UploadLimits;
}

/** 列出 thread 已上传的文件。 */
export async function listUploads(threadId: string): Promise<UploadedFileRef[]> {
  const resp = await fetch(
    `${GATEWAY_URL}/api/threads/${encodeURIComponent(threadId)}/uploads/list`,
    { method: "GET", credentials: "include", headers: jsonHeaders() }
  );
  if (!resp.ok) {
    throw await toError("列出附件失败", resp);
  }
  const data = (await resp.json()) as { files?: Record<string, unknown>[]; count?: number };
  return (data.files ?? []).map(toFileRef);
}

/** 删除 thread 的某个已上传文件。 */
export async function deleteUpload(threadId: string, filename: string): Promise<void> {
  const resp = await fetch(
    `${GATEWAY_URL}/api/threads/${encodeURIComponent(threadId)}/uploads/${encodeURIComponent(filename)}`,
    { method: "DELETE", credentials: "include", headers: jsonHeaders() }
  );
  if (!resp.ok) {
    throw await toError("删除附件失败", resp);
  }
  // best-effort 消费 body（无关键 payload）
  try {
    await resp.text();
  } catch {
    /* ignore */
  }
}

/** 读取某次 run 记录的 workspace/output 变更，用于展示真实交付文件。 */
export async function getWorkspaceChanges(
  threadId: string,
  runId: string
): Promise<WorkspaceChangesResponse> {
  const resp = await fetch(
    `${GATEWAY_URL}/api/threads/${encodeURIComponent(threadId)}/runs/${encodeURIComponent(runId)}/workspace-changes?include_files=true&include_diff=false`,
    { method: "GET", credentials: "include", headers: jsonHeaders() }
  );
  if (!resp.ok) {
    throw await toError("读取交付文件失败", resp);
  }
  const data = (await resp.json()) as Partial<WorkspaceChangesResponse>;
  return {
    available: Boolean(data.available),
    files: Array.isArray(data.files) ? data.files : [],
    summary: data.summary
  };
}

/** 将引擎返回的虚拟产出路径转换为可访问的 artifact URL。 */
export function artifactUrl(threadId: string, virtualPath: string): string {
  const normalized = virtualPath.replace(/^\/+/, "");
  const encodedPath = normalized.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `${GATEWAY_URL}/api/threads/${encodeURIComponent(threadId)}/artifacts/${encodedPath}`;
}

// ── 内部工具 ──
function jsonHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const csrf = readCsrfToken();
  if (csrf) h["X-CSRF-Token"] = csrf;
  return h;
}

/** multipart/form-data 请求专用：只带 CSRF，不加 Content-Type（浏览器自动加 boundary）。 */
function csrfHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const csrf = readCsrfToken();
  if (csrf) h["X-CSRF-Token"] = csrf;
  return h;
}

/** 从引擎 UploadedFileInfo dict 提取前端需要的字段子集。 */
function toFileRef(raw: Record<string, unknown>): UploadedFileRef {
  return {
    filename: String(raw.filename ?? ""),
    size: Number(raw.size ?? 0),
    virtual_path: String(raw.virtual_path ?? ""),
    artifact_url: String(raw.artifact_url ?? ""),
    ...(typeof raw.original_filename === "string" ? { original_filename: raw.original_filename } : {}),
    ...(typeof raw.extension === "string" ? { extension: raw.extension } : {}),
    ...(typeof raw.markdown_file === "string" ? { markdown_file: raw.markdown_file } : {}),
    ...(typeof raw.markdown_artifact_url === "string"
      ? { markdown_artifact_url: raw.markdown_artifact_url }
      : {})
  };
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
