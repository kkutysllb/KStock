// ── turnReducer：SSE chunk → assistant turn 状态 ──────────────────────
// 纯函数 reducer，UI 流式的核心。每收到一帧 SSE 调用 reduceFrame，
// 产出新的 AssistantTurnState，由调用方回写 session.messages[turnId]。
//
// 基于 Task 0 实测确认的引擎真实协议：
//   event: messages  → data = [msg_dict, metadata_dict]，取 data[0]
//     msg.type: "human" | "ai" | "tool" | "system"
//     ai message: content（增量正文）、additional_kwargs.reasoning_content（思考流）、
//                 tool_calls（工具调用请求）、usage_metadata（用量）
//                 additional_kwargs.hide_from_ui=true → system reminder，跳过
//     tool message: tool_call_id + content + artifact → 回填 toolCall
//   event: custom    → data = { type, task_id, ... }（task_tool 产出）
//     task_started/running/completed/failed/cancelled/timed_out
//   event: values    → data = { title, messages, artifacts, ... }（快照）
//   event: end       → turn 完成（data 可能含 usage）
//   event: error/gap → turn 失败

import type { ChatMessage, SubagentStep, ToolCall } from "./sessionStore";
import type { SseFrame } from "./sseParser";

/**
 * assistant turn 的流式累积状态。继承 ChatMessage 的所有字段，
 * 另加内部追踪字段（UI 渲染时忽略带下划线前缀的内部字段）。
 */
export interface AssistantTurnState extends Partial<ChatMessage> {
  /** @internal compaction 检测：已见 values.messages 最大长度。 */
  seenMsgCount?: number;
  /** 引擎 values 快照的 thread 标题（Task 9 可用于更新 session.title）。 */
  threadTitle?: string;
}

/** 初始空 turn 状态（streaming）。 */
export function initialTurn(): AssistantTurnState {
  return { text: "", status: "streaming" };
}

/**
 * 把一帧 SSE 应用到 turn 状态，返回新状态（不可变）。
 * @param state 当前 turn 状态
 * @param frame SSE 帧（event + data）
 * @param now 当前时间戳（reasoning 计时用，传 Date.now()）
 */
export function reduceFrame(
  state: AssistantTurnState,
  frame: SseFrame,
  now: number
): AssistantTurnState {
  switch (frame.event) {
    case "messages":
      return reduceMessages(state, frame.data, now);
    case "custom":
      return reduceCustom(state, frame.data);
    case "values":
      return reduceValues(state, frame.data);
    case "end":
      return reduceEnd(state, frame.data, now);
    case "error":
    case "gap":
      return reduceError(state, frame.event, frame.data);
    default:
      return state; // metadata 等无关帧
  }
}

// ── messages 事件 ─────────────────────────────────────────────────────

function reduceMessages(
  state: AssistantTurnState,
  data: unknown,
  now: number
): AssistantTurnState {
  // data 是 [msg_dict, metadata_dict] 数组，取 [0]
  if (!Array.isArray(data) || data.length === 0) return state;
  const msg = data[0];
  if (!msg || typeof msg !== "object") return state;

  const ak = (msg as Record<string, unknown>).additional_kwargs as
    | Record<string, unknown>
    | undefined;
  // system reminder 隐藏标记：跳过（不累加 text，不触发 reasoning）
  if (ak?.hide_from_ui === true) return state;

  const type = (msg as Record<string, unknown>).type as string;
  if (type === "ai") return reduceAiMessage(state, msg as Record<string, unknown>, now);
  if (type === "tool") return reduceToolMessage(state, msg as Record<string, unknown>);
  // human / system /未知：reducer 不处理（human 由 handleSend append）
  return state;
}

function reduceAiMessage(
  state: AssistantTurnState,
  msg: Record<string, unknown>,
  now: number
): AssistantTurnState {
  const next: AssistantTurnState = { ...state };

  // 正文增量（空 content 忽略：values 快照补发的空 content 不影响）
  const content = msg.content;
  if (typeof content === "string" && content) {
    next.text = (next.text ?? "") + content;
  }

  // reasoning 流：兼容 reasoning_content（DeepSeek/o1）与 reasoning（其他 provider）
  const ak = msg.additional_kwargs as Record<string, unknown> | undefined;
  const rc = ak?.reasoning_content ?? ak?.reasoning;
  if (typeof rc === "string" && rc) {
    const prev = next.reasoning;
    next.reasoning = prev
      ? { ...prev, text: prev.text + rc }
      : { text: rc, startedAt: now };
  }

  // tool_calls：合并进 toolCalls[]（按 id 去重，status=running）
  const toolCalls = msg.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    // 首个 tool_call 时刻 = reasoning 结束（若有 reasoning 且未收尾）
    if (next.reasoning && next.reasoning.endedAt == null) {
      next.reasoning = { ...next.reasoning, endedAt: now };
    }
    next.toolCalls = mergeToolCalls(
      next.toolCalls ?? [],
      toolCalls as Array<Record<string, unknown>>
    );
  }

  // usage_metadata
  const um = msg.usage_metadata as Record<string, unknown> | undefined;
  if (um && typeof um === "object") {
    next.usage = {
      input_tokens: numOr(um.input_tokens, 0),
      output_tokens: numOr(um.output_tokens, 0),
      total_tokens: numOr(um.total_tokens, 0)
    };
  }

  return next;
}

function reduceToolMessage(
  state: AssistantTurnState,
  msg: Record<string, unknown>
): AssistantTurnState {
  const toolCallId = msg.tool_call_id as string | undefined;
  if (!toolCallId) return state;
  const calls = state.toolCalls ?? [];
  const idx = calls.findIndex((tc) => tc.id === toolCallId);
  if (idx < 0) return state; // 无匹配的 tool_call（可能来自 hide_from_ui 的调用），忽略

  const content = msg.content;
  const resultStr =
    typeof content === "string" ? content : JSON.stringify(content ?? "");
  const updated = [...calls];
  updated[idx] = {
    ...updated[idx],
    result: resultStr,
    artifact: msg.artifact,
    status: "done"
  };
  return { ...state, toolCalls: updated };
}

function mergeToolCalls(
  existing: ToolCall[],
  incoming: Array<Record<string, unknown>>
): ToolCall[] {
  const map = new Map<string, ToolCall>(existing.map((tc) => [tc.id, tc]));
  for (const raw of incoming) {
    const id = String(raw.id ?? "<auto>");
    const name = String(raw.name ?? map.get(id)?.name ?? "unknown");
    const rawArgs = raw.args;
    const args =
      typeof rawArgs === "string"
        ? (safeJsonParse(rawArgs, {}) as Record<string, unknown>)
        : rawArgs && typeof rawArgs === "object"
          ? (rawArgs as Record<string, unknown>)
          : {};
    const prev = map.get(id);
    map.set(id, {
      id,
      name,
      args: prev ? { ...prev.args, ...args } : args,
      status: "running"
    });
  }
  return [...map.values()];
}

// ── custom 事件（task_tool 产出） ────────────────────────────────────

const TASK_STATUS_MAP: Record<string, SubagentTaskStatus> = {
  task_completed: "completed",
  task_failed: "failed",
  task_cancelled: "cancelled",
  task_timed_out: "timed_out"
};

type SubagentTaskStatus = "completed" | "failed" | "cancelled" | "timed_out";

function reduceCustom(
  state: AssistantTurnState,
  data: unknown
): AssistantTurnState {
  if (!data || typeof data !== "object") return state;
  const ev = data as Record<string, unknown>;
  const type = ev.type as string;

  switch (type) {
    case "task_started":
      return reduceTaskStarted(state, ev);
    case "task_running":
      return reduceTaskRunning(state, ev);
    case "task_completed":
    case "task_failed":
    case "task_cancelled":
    case "task_timed_out":
      return reduceTaskEnded(state, ev, type);
    default:
      return state; // guardrail/skill_activation 等其它 custom 事件暂不处理
  }
}

function reduceTaskStarted(
  state: AssistantTurnState,
  ev: Record<string, unknown>
): AssistantTurnState {
  const taskId = ev.task_id as string | undefined;
  if (!taskId) return state;
  const subs = state.subagents ?? [];
  if (subs.find((s) => s.taskId === taskId)) return state; // 去重（重放）
  return {
    ...state,
    subagents: [
      ...subs,
      {
        taskId,
        description: strOr(ev.description),
        model: strOr(ev.model_name),
        status: "running",
        steps: []
      }
    ]
  };
}

function reduceTaskRunning(
  state: AssistantTurnState,
  ev: Record<string, unknown>
): AssistantTurnState {
  const taskId = ev.task_id as string | undefined;
  if (!taskId) return state;
  const subs = state.subagents ?? [];
  const idx = subs.findIndex((s) => s.taskId === taskId);
  if (idx < 0) return state;

  const message = ev.message as Record<string, unknown> | undefined;
  const index = numOr(ev.message_index, subs[idx].steps.length + 1);

  const step: SubagentStep = { index };
  if (message && typeof message.content === "string") {
    step.text = message.content;
  }
  if (message && Array.isArray(message.tool_calls)) {
    step.toolCalls = mergeToolCalls(
      [],
      message.tool_calls as Array<Record<string, unknown>>
    );
  }

  // 按 index 去重（重放时更新而非追加）
  const prevSteps = subs[idx].steps;
  const existingStepIdx = prevSteps.findIndex((s) => s.index === index);
  const nextSteps =
    existingStepIdx >= 0
      ? prevSteps.map((s, i) => (i === existingStepIdx ? { ...s, ...step } : s))
      : [...prevSteps, step];

  const updated = [...subs];
  updated[idx] = { ...updated[idx], steps: nextSteps };
  return { ...state, subagents: updated };
}

function reduceTaskEnded(
  state: AssistantTurnState,
  ev: Record<string, unknown>,
  type: string
): AssistantTurnState {
  const taskId = ev.task_id as string | undefined;
  if (!taskId) return state;
  const status = TASK_STATUS_MAP[type];
  if (!status) return state;
  const subs = state.subagents ?? [];
  const idx = subs.findIndex((s) => s.taskId === taskId);
  if (idx < 0) return state;
  const updated = [...subs];
  updated[idx] = { ...updated[idx], status };
  return { ...state, subagents: updated };
}

// ── values 快照 ──────────────────────────────────────────────────────

function reduceValues(
  state: AssistantTurnState,
  data: unknown
): AssistantTurnState {
  if (!data || typeof data !== "object") return state;
  const snap = data as Record<string, unknown>;
  const next: AssistantTurnState = { ...state };

  if (typeof snap.title === "string" && snap.title) next.threadTitle = snap.title;
  if (Array.isArray(snap.artifacts)) next.artifacts = snap.artifacts;

  // compaction 检测：messages 数量收缩（宁漏勿错——不确定时不标注）
  if (Array.isArray(snap.messages)) {
    const prev = next.seenMsgCount ?? 0;
    const curr = snap.messages.length;
    if (prev > 0 && curr < prev) {
      next.status = "compacted";
    }
    next.seenMsgCount = Math.max(prev, curr);
  }

  return next;
}

// ── end / error ──────────────────────────────────────────────────────

function reduceEnd(
  state: AssistantTurnState,
  data: unknown,
  now: number
): AssistantTurnState {
  const next: AssistantTurnState = { ...state };
  // compaction 标记不被 end 覆盖
  if (next.status !== "compacted") next.status = "done";

  // 收尾 reasoning：若 endedAt 未填则填 now；无论何时结束，补算 thinkingMs
  if (next.reasoning) {
    const reasoning =
      next.reasoning.endedAt == null
        ? { ...next.reasoning, endedAt: now }
        : next.reasoning;
    next.reasoning = reasoning;
    if (next.thinkingMs == null && reasoning.endedAt != null) {
      next.thinkingMs = reasoning.endedAt - reasoning.startedAt;
    }
  }

  // 补 usage（end 帧可能带 usage：{ input, output, total }）
  const endData = data as { usage?: Record<string, unknown> } | null | undefined;
  if (endData?.usage && !next.usage) {
    const u = endData.usage;
    next.usage = {
      input_tokens: numOr(u.input, 0),
      output_tokens: numOr(u.output, 0),
      total_tokens: numOr(u.total, 0)
    };
  }

  return next;
}

function reduceError(
  state: AssistantTurnState,
  event: string,
  data: unknown
): AssistantTurnState {
  const message =
    typeof data === "string" && data
      ? data
      : event === "gap"
        ? "流中断（stream replay gap），请重载"
        : "引擎 run 报错";
  return { ...state, status: "error", error: message };
}

// ── 内部工具 ──────────────────────────────────────────────────────────

function numOr(v: unknown, dft: number): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : dft;
}

function strOr(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

function safeJsonParse(s: string, dft: unknown): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return dft;
  }
}
