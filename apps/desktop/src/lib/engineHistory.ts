// ── 引擎历史消息 → 前端 ChatMessage[] 转换 ────────────────────────────
//
// 用于切回历史会话时懒加载：GET /api/threads/{tid}/messages 返回引擎事件行
// 数组（RunEventRow，按 seq 排序），本模块转成前端 ChatMessage[] 供 ChatFeed 渲染。
//
// 事件行结构（vendor/qilin/qilin/runtime/journal.py 持久化、
// runtime/events/store/db.py 读取时 JSON.parse content）：
//   {
//     event_type: "llm.human.input" | "llm.ai.response" | "llm.tool.result" | ...,
//     category:   "message",
//     content:    <langchain message 的 model_dump() dict>,
//     metadata:   { caller, usage?, ... },
//     run_id, thread_id, seq, created_at
//   }
// content 内嵌的 langchain message dict 含：type/content/tool_calls/
// additional_kwargs/usage_metadata 等标准字段。
//
// 与 turnReducer 的区别：
//   turnReducer 处理 SSE 流式增量帧（逐帧 reduce 到 turn state）
//   本模块处理一次性返回的完整事件行数组（历史快照，status 已是最终态）
//
// 历史消息是"已完成"状态，转换后 status="done"（无 streaming/error 分支）。

import type { ChatMessage, ReasoningBlock, ToolCall, TurnUsage } from "./sessionStore";

/**
 * 把引擎历史事件行数组转换为前端 ChatMessage[]。
 *
 * 每个事件行的 content 字段是 langchain message 的 model_dump() dict。
 * 本函数先从事件行提取内嵌 message，再按 message.type 路由：
 * - human → 新建 user message（content）
 * - ai（有 content/tool_calls/reasoning 信号）→ 新建 assistant turn
 * - tool → 回填到最近的 assistant turn 的 toolCalls（按 tool_call_id 匹配）
 * - system / hide_from_ui → 跳过
 *
 * 也兼容直接传入 langchain message 数组（message 在顶层而非嵌套在 content）
 * 的旧格式，保证向后兼容。
 *
 * 未知格式宽容忽略（避免历史消息格式演进导致前端崩溃）。
 */
export function engineMessagesToChatMessages(messages: unknown[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  let lastAssistant: ChatMessage | null = null;

  for (const raw of messages) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    // 从事件行提取内嵌的 langchain message dict。
    // 事件行格式：{ event_type, content: <message dict>, ... }
    // 旧格式/直接 message：{ type, content, tool_calls, ... }（顶层就是 message）
    const msg = extractEmbeddedMessage(row);
    const type = typeof msg.type === "string" ? msg.type.toLowerCase() : "";
    const ak = (msg.additional_kwargs ?? {}) as Record<string, unknown>;

    // system / 隐藏消息：跳过
    if (type.includes("system")) continue;
    if (ak.hide_from_ui === true) continue;

    // ── human message ──
    if (type.includes("human")) {
      const content = extractTextContent(msg.content);
      if (!content.trim()) continue;
      result.push({
        id: ensureId(msg.id),
        role: "user",
        createdAt: ensureTimestamp(row, msg),
        content,
      });
      // human 后重置 lastAssistant（下一个 ai 是新 turn）
      lastAssistant = null;
      continue;
    }

    // ── tool message（按 tool_call_id 回填到最近的 assistant turn）──
    // 兼容 type="tool" 或无 type 但有 tool_call_id 的消息。
    if (type.includes("tool") || (typeof msg.tool_call_id === "string" && msg.tool_call_id)) {
      const standaloneTurn = backfillToolResult(lastAssistant, row, msg);
      if (standaloneTurn) {
        result.push(standaloneTurn);
        lastAssistant = standaloneTurn;
      }
      continue;
    }

    // ── ai message ──
    // 历史消息 type 应明确：优先按 type=ai 识别。
    // 对于 type 缺失或未知的消息，要求强信号（tool_calls/usage_metadata）
    // 才视为 ai——避免把纯 content 的未知消息误判为 ai 气泡。
    if (type.includes("ai") || hasStrongAiSignal(msg)) {
      const turn = buildAssistantTurn(row, msg, ak);
      // 空 turn（无 text/toolCalls/reasoning）忽略，避免渲染空气泡
      if (turn.text || (turn.toolCalls && turn.toolCalls.length > 0) || turn.reasoning) {
        if (lastAssistant && canMergeAssistantTurns(lastAssistant, turn)) {
          mergeAssistantTurns(lastAssistant, turn);
        } else {
          result.push(turn);
          lastAssistant = turn;
        }
      }
      continue;
    }

    // 其他类型（未知）：宽容忽略
  }

  return result;
}

function canMergeAssistantTurns(previous: ChatMessage, next: ChatMessage): boolean {
  return !previous.runId || !next.runId || previous.runId === next.runId;
}

/** 把同一轮中的中间 assistant 事件折叠进首个 turn，避免工具调用平铺成多条消息。 */
function mergeAssistantTurns(target: ChatMessage, incoming: ChatMessage): void {
  if (incoming.text) target.text = incoming.text;
  if (incoming.reasoning) target.reasoning = incoming.reasoning;
  if (incoming.usage) target.usage = incoming.usage;
  if (incoming.error) {
    target.error = incoming.error;
    target.status = incoming.status;
  }
  if (incoming.toolCalls?.length) {
    const toolCalls = target.toolCalls ? [...target.toolCalls] : [];
    for (const incomingCall of incoming.toolCalls) {
      const index = toolCalls.findIndex((call) => call.id === incomingCall.id);
      if (index < 0) {
        toolCalls.push(incomingCall);
      } else {
        toolCalls[index] = { ...toolCalls[index], ...incomingCall };
      }
    }
    target.toolCalls = toolCalls;
  }
  if (incoming.status === "needs_input" || hasHumanInputToolCall(target.toolCalls)) {
    target.status = "needs_input";
  }
}

// ── 字段提取辅助 ────────────────────────────────────────────────────

/**
 * 从事件行提取内嵌的 langchain message dict。
 *
 * 引擎返回的是事件行（RunEventRow）：
 *   { event_type, category, content: <message model_dump()>, metadata, ... }
 * content 可能是 dict（已 JSON.parse）或 JSON string（未 parse），也可能是
 * 原始字符串（极少数 legacy 场景）。
 *
 * 兼容直接传入 langchain message 的旧格式（顶层就有 type/content）。
 */
function extractEmbeddedMessage(row: Record<string, unknown>): Record<string, unknown> {
  // 旧格式：row 本身就是 langchain message（顶层有 type 或 tool_call_id）。
  // 必须先判，否则 message 的 content（字符串/数组）会被误当内嵌 message。
  if (typeof row.type === "string" || typeof row.tool_call_id === "string") {
    return row;
  }
  const content = row.content;
  // 事件行格式：content 是内嵌 message dict
  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content as Record<string, unknown>;
  }
  if (typeof content === "string") {
    const trimmed = content.trim();
    // JSON string → parse 后判断是否是 message dict
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      const parsed = safeJsonParse(trimmed, null);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }
    // 纯文本 content：包装成类 message dict（content 字段保留原始文本）。
    // 出现在简化事件行（非 langchain 持久化，content 是裸字符串）。
    return { content: trimmed, type: inferTypeFromEventRow(row) };
  }
  return {};
}

/** 根据事件行的 event_type 推断 langchain message type（content 为纯文本时使用）。 */
function inferTypeFromEventRow(row: Record<string, unknown>): string {
  const et = typeof row.event_type === "string" ? row.event_type : "";
  if (et.includes("human")) return "human";
  if (et.includes("ai")) return "ai";
  if (et.includes("tool")) return "tool";
  if (et.includes("system")) return "system";
  return "";
}

/**
 * 从消息 content 提取纯文本。
 *
 * 引擎 content 有两种形态：
 * - string：直接返回
 * - content blocks 数组：[{type:"text", text:"..."}, {type:"tool_use", ...}]
 *   遍历取 type==="text" 的 text 字段拼接（其他类型忽略，工具调用走 tool_calls）
 */
function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") return b.text;
        return "";
      })
      .join("");
  }
  return "";
}

/**
 * 判断 type 缺失/未知的消息是否携带强 AI 信号（用于识别无 type 的 ai 消息）。
 *
 * 与 hasAiSignal 的区别：不凭纯 content 判断（避免把未知类型的文本消息
 * 误判为 ai）。只认 tool_calls / usage_metadata / reasoning / error_fallback
 * 这些 ai 独有的强信号。
 */
function hasStrongAiSignal(msg: Record<string, unknown>): boolean {
  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) return true;
  const um = msg.usage_metadata;
  if (um && typeof um === "object") return true;
  const ak = (msg.additional_kwargs ?? {}) as Record<string, unknown>;
  if (ak.qilin_error_fallback === true) return true;
  const rc = (ak.reasoning_content ?? ak.reasoning) as unknown;
  if (typeof rc === "string" && rc) return true;
  return false;
}

/** 构造一个 assistant turn（最终态，status="done"）。 */
function buildAssistantTurn(
  row: Record<string, unknown>,
  msg: Record<string, unknown>,
  ak: Record<string, unknown>
): ChatMessage {
  const text = extractTextContent(msg.content);
  const reasoning = extractReasoning(ak);
  const toolCalls = extractToolCalls(msg.tool_calls);
  const usage = extractUsage(msg.usage_metadata);

  // qilin_error_fallback：引擎把 provider error 包装成 ai message
  const isError = ak.qilin_error_fallback === true;
  const errorText =
    isError && text ? text : isError ? "引擎处理出错（历史记录）" : undefined;

  const turn: ChatMessage = {
    id: ensureId(msg.id),
    role: "assistant",
    createdAt: ensureTimestamp(row, msg),
    status: errorText ? "error" : "done",
    ...(typeof row.run_id === "string" && row.run_id ? { runId: row.run_id } : {}),
    ...(text ? { text } : {}),
    ...(reasoning ? { reasoning } : {}),
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(usage ? { usage } : {}),
    ...(errorText ? { error: errorText } : {}),
  };
  return turn;
}

/** 从 additional_kwargs 提取 reasoning（兼容 reasoning_content / reasoning）。 */
function extractReasoning(ak: Record<string, unknown>): ReasoningBlock | undefined {
  const rc = (ak.reasoning_content ?? ak.reasoning) as unknown;
  if (typeof rc !== "string" || !rc) return undefined;
  const now = Date.now();
  return { text: rc, startedAt: now, endedAt: now };
}

/** 转换 tool_calls 数组（args 可能是 string JSON 或 object）。 */
function extractToolCalls(raw: unknown): ToolCall[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): ToolCall | null => {
      if (!item || typeof item !== "object") return null;
      const tc = item as Record<string, unknown>;
      const id = String(tc.id ?? "<auto>");
      const name = String(tc.name ?? "unknown");
      const argsRaw = tc.args;
      const args =
        typeof argsRaw === "string"
          ? (safeJsonParse(argsRaw, {}) as Record<string, unknown>)
          : argsRaw && typeof argsRaw === "object"
            ? (argsRaw as Record<string, unknown>)
            : {};
      return {
        id,
        name,
        args,
        status: "done", // 历史消息中的 tool_call 若无对应 tool message，也标记为 done（避免 running 卡住）
      };
    })
    .filter((tc): tc is ToolCall => tc !== null);
}

/** 回填 tool 执行结果到最近的 assistant turn。 */
function backfillToolResult(
  lastAssistant: ChatMessage | null,
  row: Record<string, unknown>,
  msg: Record<string, unknown>
): ChatMessage | null {
  const isClarification = isClarificationToolMessage(msg);
  const content = msg.content;
  const resultStr =
    typeof content === "string" ? content : JSON.stringify(content ?? "");

  if (!lastAssistant || !lastAssistant.toolCalls) {
    return isClarification ? buildStandaloneClarificationTurn(row, msg, resultStr) : null;
  }
  const tcId = String(msg.tool_call_id ?? "");
  const idx = lastAssistant.toolCalls.findIndex((tc) => tc.id === tcId);
  if (idx < 0) {
    if (!isClarification) return null;
    lastAssistant.toolCalls = [
      ...lastAssistant.toolCalls,
      clarificationToolCallFromMessage(msg, resultStr),
    ];
    lastAssistant.status = "needs_input";
    if (!lastAssistant.text && resultStr) lastAssistant.text = resultStr;
    return null;
  }
  lastAssistant.toolCalls[idx] = {
    ...lastAssistant.toolCalls[idx],
    result: resultStr,
    artifact: msg.artifact,
    status: "done",
  };
  const derivedArtifacts = artifactsFromToolResult(
    lastAssistant.toolCalls[idx].name,
    resultStr,
    msg.artifact
  );
  if (derivedArtifacts.length > 0) {
    lastAssistant.artifacts = mergeArtifacts(lastAssistant.artifacts, derivedArtifacts);
  }
  if (isClarification) {
    lastAssistant.status = "needs_input";
    if (!lastAssistant.text && resultStr) lastAssistant.text = resultStr;
  }
  return null;
}

function buildStandaloneClarificationTurn(
  row: Record<string, unknown>,
  msg: Record<string, unknown>,
  resultStr: string
): ChatMessage {
  return {
    id: ensureId(msg.id),
    role: "assistant",
    createdAt: ensureTimestamp(row, msg),
    status: "needs_input",
    ...(typeof row.run_id === "string" && row.run_id ? { runId: row.run_id } : {}),
    ...(resultStr ? { text: resultStr } : {}),
    toolCalls: [clarificationToolCallFromMessage(msg, resultStr)],
  };
}

function clarificationToolCallFromMessage(
  msg: Record<string, unknown>,
  resultStr: string
): ToolCall {
  return {
    id: String(msg.tool_call_id || msg.id || ensureId(undefined)),
    name: typeof msg.name === "string" && msg.name ? msg.name : "ask_clarification",
    args: {},
    result: resultStr,
    artifact: msg.artifact,
    status: "done",
  };
}

function hasHumanInputToolCall(calls: ToolCall[] | undefined): boolean {
  return Boolean(calls?.some((call) => call.name === "ask_clarification" && hasHumanInputArtifact(call.artifact)));
}

function isClarificationToolMessage(msg: Record<string, unknown>): boolean {
  return msg.name === "ask_clarification" || hasHumanInputArtifact(msg.artifact);
}

function hasHumanInputArtifact(artifact: unknown): boolean {
  if (!artifact || typeof artifact !== "object") return false;
  const record = artifact as Record<string, unknown>;
  const payload = record.human_input ?? record;
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return p.kind === "human_input_request" || p.source === "ask_clarification";
}

function artifactsFromToolResult(toolName: string, resultStr: string, artifact: unknown): unknown[] {
  const artifacts: unknown[] = [];
  if (artifact && typeof artifact === "object" && !hasHumanInputArtifact(artifact)) {
    const record = artifact as Record<string, unknown>;
    if (
      typeof record.path === "string" ||
      typeof record.virtual_path === "string" ||
      typeof record.artifact_url === "string"
    ) {
      artifacts.push(artifact);
    }
  }

  const parsed = safeJsonParse(resultStr, null);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    for (const field of ["thread_virtual_path", "virtual_path", "path"]) {
      if (typeof record[field] === "string" && record[field]) artifacts.push(record[field]);
    }
    if (Array.isArray(record.artifacts)) artifacts.push(...record.artifacts);
  }

  // render_html_report 的主交付文件固定是 report.html；旧工具结果若只返回
  // report_id 而漏了路径，也保守补齐，保证历史任务右侧有报告入口。
  if (toolName === "render_html_report" && artifacts.length === 0) {
    artifacts.push("/outputs/report.html");
  }
  return mergeArtifacts([], artifacts);
}

function mergeArtifacts(existing: unknown[] | undefined, incoming: unknown[]): unknown[] {
  const merged: unknown[] = [];
  const seen = new Set<string>();
  for (const item of [...(existing ?? []), ...incoming]) {
    const key = artifactKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function artifactKey(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    return String(record.path ?? record.virtual_path ?? record.artifact_url ?? JSON.stringify(record));
  }
  return "";
}

/** 转换 usage_metadata。 */
function extractUsage(raw: unknown): TurnUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const um = raw as Record<string, unknown>;
  return {
    input_tokens: numOr(um.input_tokens, 0),
    output_tokens: numOr(um.output_tokens, 0),
    total_tokens: numOr(um.total_tokens, 0),
  };
}

// ── 通用工具 ──

function ensureId(id: unknown): string {
  return typeof id === "string" && id ? id : crypto.randomUUID();
}

function ensureTimestamp(
  row: Record<string, unknown>,
  msg: Record<string, unknown>
): string {
  // 优先用事件行的 created_at（RunEventRow 持久化时间戳）；
  // 兼容 message 自身的 created_at / timestamp（旧格式直传 message）。
  const ca = row.created_at ?? msg.created_at ?? msg.timestamp;
  if (typeof ca === "string" && ca) return ca;
  if (typeof ca === "number") return new Date(ca).toISOString();
  return new Date().toISOString();
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && !isNaN(v) ? v : fallback;
}

function safeJsonParse(s: string, fallback: unknown): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}
