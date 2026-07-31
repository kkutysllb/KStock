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
    reportMarkdown: buildReportMarkdown({
      id: "preview",
      title,
      createdAt: nowIso(),
      updatedAt: nowLabel(),
      messages: [],
      reportMarkdown: "",
      activeSkills: DEFAULT_ACTIVE_SKILLS
    }),
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

// ── 以下两个为过渡期假桩，Task 9 接入真实 run 后移除 ──
/** @deprecated Task 9 接入引擎 run 后移除。 */
export function synthesizeAssistantReply(query: string): {
  message: string;
  activeSkills: string[];
} {
  return {
    message: `已接收研究请求：${query}。正在调用精选技能生成结构化分析与报告。`,
    activeSkills: [...DEFAULT_ACTIVE_SKILLS]
  };
}

/** @deprecated Task 9 改为从 turn artifacts 真实来源生成。 */
export function buildReportMarkdown(session: ChatSession): string {
  const lastUserMessage = [...session.messages].reverse().find((message) => message.role === "user");
  const query = lastUserMessage?.content ?? "等待用户输入";
  return `
# ${session.title}

## 研究问题

${query}

## 当前结论

- 已启用精选技能：${session.activeSkills.join(" / ")}
- 适合继续补充财报、估值、行业、公告和宏观数据
- 报告输出将保持 Markdown 结构

## 下一步

1. 拉取最新数据
2. 汇总关键指标
3. 生成报告和图表
`.trim();
}
