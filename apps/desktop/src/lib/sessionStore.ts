export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** 用户消息关联的模型选择（用于后续对接引擎 run）。 */
  model?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
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
    content,
    createdAt: nowIso(),
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

export function synthesizeAssistantReply(query: string): {
  message: string;
  activeSkills: string[];
} {
  return {
    message: `已接收研究请求：${query}。正在调用精选技能生成结构化分析与报告。`,
    activeSkills: [...DEFAULT_ACTIVE_SKILLS]
  };
}

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
