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
  result?: string;
  artifact?: unknown;
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

export interface TurnUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export type TurnStatus = "streaming" | "done" | "error" | "compacted";

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
  "analysis-report",
  "chart-visualization",
  "kk-common",
  "kk-stock-analysis",
  "kk-financial-statement",
  "kk-valuation-model",
  "kk-industry-analysis",
  "kk-news-search",
  "kk-report-search",
  "kk-announcement-search",
  "kk-business-query",
  "kk-macro-query"
];

function nowLabel() {
  return new Date().toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
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

export function createSeedSessions(): ChatSession[] {
  const first = createSession("贵州茅台财报复盘");
  const second = createSession("行业与宏观跟踪");
  return [first, second];
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


