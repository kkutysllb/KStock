// ── turn-based 对话数据模型 ────────────────────────────────────────────
// user 消息用 content；assistant turn 用流式累积字段（text/reasoning/toolCalls/
// subagents），由 turnReducer 从 SSE chunk 逐步填充。status 标记生命周期。

export type ChatRole = "user" | "assistant";

/** assistant 的思考流（reasoning_content）。流式中 startedAt 已填，完成后填 endedAt。 */
export interface ReasoningBlock {
  text: string;
  startedAt: number;
  endedAt?: number;
}

/** 工具调用：模型发起（status=running）→ 引擎回填结果（status=done/error）。 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: "running" | "done" | "error";
  /** 前端收到工具调用请求的时间戳（流式运行时填充）。 */
  startedAt?: number;
  /** 前端收到工具结果的时间戳（流式运行时填充）。 */
  endedAt?: number;
  result?: string;
  artifact?: unknown;
}

/**
 * ask_clarification 工具的结构化 payload（引擎 ClarificationMiddleware 生成）。
 * 存放在 ask_clarification 的 ToolMessage.artifact.human_input 里。
 * 协议见 vendor/qilin/qilin/agents/middlewares/clarification_middleware.py
 * _build_human_input_payload。
 */
export interface ClarificationOption {
  id: string;
  label: string;
  value: string;
}

export interface HumanInputPayload {
  kind: "human_input_request";
  source: "ask_clarification";
  request_id?: string;
  clarification_type?: string;
  question: string;
  /** free_text / choice_with_other / form；三种模式均渲染交互卡片。 */
  input_mode: "free_text" | "choice_with_other" | "form";
  context?: string | null;
  /** input_mode=choice_with_other 时的候选项。 */
  options?: ClarificationOption[];
  /** input_mode=form 时的表单字段（对齐引擎 _normalize_fields 产物）。 */
  fields?: ClarificationFormField[];
}

/** ask_clarification form 模式的表单字段（引擎 schema 的镜像）。 */
export interface ClarificationFormField {
  name: string;
  label?: string;
  type: "text" | "textarea" | "number" | "select" | "multi_select" | "checkbox" | "date";
  required?: boolean;
  /** select / multi_select 的候选项（字符串数组）。 */
  options?: string[];
  placeholder?: string;
}

/** subagent 单步进展（对应引擎 task_running 的 message）。 */
export interface SubagentStep {
  /** 引擎 task_running 的 message_index（1-based）。 */
  index: number;
  /** subagent ai 正文（完整消息内容，非增量）。 */
  text?: string;
  /** subagent 自己发起的工具调用（若有）。 */
  toolCalls?: ToolCall[];
}

/** 并行 subagent（引擎 task_tool 产出，按 task_id 分组）。 */
export interface SubagentTask {
  taskId: string;
  description?: string;
  model?: string;
  status: "running" | "completed" | "failed" | "cancelled" | "timed_out";
  steps: SubagentStep[];
}

/** 引擎 lead agent 的 Todo 状态（对应 ThreadState.todos）。 */
export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface TurnUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export type TurnStatus = "streaming" | "needs_input" | "done" | "error" | "compacted";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  createdAt: string;
  /** 用户消息关联的模型选择（用于 run context 注入）。 */
  model?: string;
  // ── user 消息正文 ──
  content?: string;
  // ── assistant turn 流式累积 ──
  text?: string;
  reasoning?: ReasoningBlock;
  toolCalls?: ToolCall[];
  subagents?: SubagentTask[];
  /** turn 产出（引擎 values 快照的 artifacts）。 */
  artifacts?: unknown[];
  /** 引擎 values 快照的 Todo 列表。 */
  todos?: TodoItem[];
  /** 该 assistant turn 对应的引擎 run id。 */
  runId?: string;
  /** pipeline_stage（前端推断兜底）。 */
  stage?: string;
  status?: TurnStatus;
  usage?: TurnUsage;
  /** reasoning 耗时（ms），完成后由 turnReducer 填充。 */
  thinkingMs?: number;
  error?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** 引擎 thread id（首次发消息时 POST /api/threads 创建并绑定）。 */
  threadId?: string;
  messages: ChatMessage[];
  reportMarkdown: string;
  activeSkills: string[];
}

export const DEFAULT_ACTIVE_SKILLS = [
  "chart-visualization",
  "common",
  "stock-analysis",
  "financial-statement",
  "valuation-model",
  "industry-analysis",
  "news-search",
  "report-search",
  "announcement-search",
  "business-query",
  "macro-query"
];

function nowLabel() {
  // 侧边栏历史任务需要区分同一天内的会话，展示到分钟（MM-DD HH:mm）
  return new Date().toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
}

function nowIso() {
  return new Date().toISOString();
}

function createMessage(role: ChatRole, content: string, model?: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    createdAt: nowIso(),
    content,
    ...(model ? { model } : {})
  };
}

/** 创建一个空的 assistant streaming turn（接入引擎 run 时用）。 */
export function createAssistantTurn(model?: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    createdAt: nowIso(),
    text: "",
    status: "streaming",
    ...(model ? { model } : {})
  };
}

export function createSession(title = "新研究会话"): ChatSession {
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: nowIso(),
    updatedAt: nowLabel(),
    messages: [],
    reportMarkdown: "",
    activeSkills: [...DEFAULT_ACTIVE_SKILLS]
  };
}

/**
 * 从引擎 thread 恢复一个 ChatSession。
 *
 * 用于启动时从 POST /api/threads/search 拉回的历史会话。这些 thread 已在后端
 * 有真实数据（消息 / 上传 / 产出），切回时需要懒加载 messages（首次发消息
 * 或用户点进该会话时才调 fetchThreadMessages）。
 *
 * 与 createSession 的区别：threadId 已绑定，title 优先从 values.title 取，
 * updated_at 用后端返回的时间戳（本地化为 MM-DD HH:mm 展示）。
 */
export function threadToSession(thread: {
  thread_id: string;
  created_at?: string;
  updated_at?: string;
  values?: Record<string, unknown>;
}): ChatSession {
  const titleRaw = thread.values?.title;
  const title = typeof titleRaw === "string" && titleRaw.trim()
    ? titleRaw.slice(0, 40)
    : "历史任务";
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: thread.created_at || nowIso(),
    updatedAt: formatUpdatedAt(thread.updated_at),
    threadId: thread.thread_id,
    messages: [],
    reportMarkdown: "",
    activeSkills: [...DEFAULT_ACTIVE_SKILLS]
  };
}

/** 把后端 ISO 时间戳转成本地 MM-DD HH:mm 展示（与 nowLabel 一致）。失败回退 nowLabel()。 */
function formatUpdatedAt(iso?: string): string {
  if (!iso) return nowLabel();
  const d = new Date(iso);
  if (isNaN(d.getTime())) return nowLabel();
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
}

export function appendMessageToSession(
  session: ChatSession,
  role: ChatRole,
  content: string,
  model?: string
): ChatSession {
  const nextMessages = [...session.messages, createMessage(role, content, model)];
  const nextTitle = session.messages.length === 0 && role === "user" ? content.slice(0, 18) : session.title;
  return {
    ...session,
    title: nextTitle,
    updatedAt: nowLabel(),
    messages: nextMessages
  };
}

/** 追加一条已构造的 message（assistant streaming turn 用）。 */
export function appendTurnToSession(session: ChatSession, message: ChatMessage): ChatSession {
  return {
    ...session,
    updatedAt: nowLabel(),
    messages: [...session.messages, message]
  };
}

/** 绑定引擎 thread id（首次发消息后调用）。 */
export function bindThreadId(session: ChatSession, threadId: string): ChatSession {
  return { ...session, threadId };
}

/**
 * 整体替换 session 的 messages（历史消息懒加载后回写）。
 *
 * 仅在 messages 为空时使用——把从引擎拉回的历史消息填入空 session。
 * 不清空已有消息（避免覆盖正在进行的流式 turn）。
 */
export function setSessionMessages(session: ChatSession, messages: ChatMessage[]): ChatSession {
  return { ...session, messages };
}

/** 用 patch 局部更新指定 message（turnReducer 产出新状态后回写 session）。 */
export function updateMessageInSession(
  session: ChatSession,
  messageId: string,
  patch: Partial<ChatMessage>
): ChatSession {
  return {
    ...session,
    updatedAt: nowLabel(),
    messages: session.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m))
  };
}
