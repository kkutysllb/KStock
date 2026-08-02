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
//   event: values    → data = { title, messages, artifacts, todos, ... }（快照）
//   event: end       → turn 完成（data 可能含 usage）
//   event: error/gap → turn 失败

import type { ChatMessage, SubagentStep, SubagentTask, TodoItem, ToolCall } from "./sessionStore";
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
      return reduceCustom(state, frame.data, now);
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
  const m = msg as Record<string, unknown>;

  const ak = m.additional_kwargs as Record<string, unknown> | undefined;
  // system reminder 隐藏标记：跳过（不累加 text，不触发 reasoning）
  if (ak?.hide_from_ui === true) return state;

  // ── 路由策略：语义优先，type 兜底 ──
  // 不依赖具体 type 字符串，以语义特征跨 provider 通用适配
  //（MiniMax/DeepSeek/Claude/vLLM/MindIE/StepFun 等均自动覆盖）。
  const type = typeof m.type === "string" ? (m.type as string) : "";
  const lowered = type.toLowerCase();

  // 1. human / system 消息：跳过（human 由 handleSend append；system 无信号时也不渲染）
  //    langchain 规范：HumanMessage/HumanMessageChunk/SystemMessage/SystemMessageChunk
  if (lowered.includes("human") || lowered.includes("system")) return state;

  // 2. 按语义特征路由（跨 provider 通用）
  //    tool message 回填：有 tool_call_id（唯一可靠特征，只有工具结果带）
  if (typeof m.tool_call_id === "string" && m.tool_call_id)
    return reduceToolMessage(state, m, now);
  //    ai 信号：reasoning 流 / 正文增量 / 工具调用请求 / 用量 / provider error 兖底
  if (hasAiSignal(m, ak)) return reduceAiMessage(state, m, now);

  // 3. type 兖底：语义信号缺失时，按已知 type 变体识别
  //    （空 content 的纯状态帧、未来 provider 的非标准字段等）
  if (lowered === "tool" || lowered === "toolmessage" || lowered === "toolmessagechunk")
    return reduceToolMessage(state, m, now);
  if (lowered === "ai" || lowered === "aimessage" || lowered === "aimessagechunk")
    return reduceAiMessage(state, m, now);

  // 未识别的消息：保守忽略（避免污染 assistant turn）
  return state;
}

/**
 * 判断消息是否携带 AI 信号字段（用于跨 provider 语义路由）。
 *
 * 覆盖：正文增量 content / reasoning 流 / 工具调用请求 / token 用量 /
 * provider error 兖底（qilin_error_fallback）。满足任一即认为是 AI 产生的内容。
 */
function hasAiSignal(
  msg: Record<string, unknown>,
  ak: Record<string, unknown> | undefined
): boolean {
  if (ak?.qilin_error_fallback === true) return true;
  const rc = (ak?.reasoning_content ?? ak?.reasoning) as unknown;
  if (typeof rc === "string" && rc) return true;
  if (typeof msg.content === "string" && msg.content) return true;
  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) return true;
  const um = msg.usage_metadata;
  if (um && typeof um === "object") return true;
  return false;
}

function reduceAiMessage(
  state: AssistantTurnState,
  msg: Record<string, unknown>,
  now: number
): AssistantTurnState {
  const next: AssistantTurnState = { ...state };

  const ak = msg.additional_kwargs as Record<string, unknown> | undefined;

  // qilin_error_fallback：引擎把 provider error 包装成 ai message，
  // 不作为正文累积，标记为 error 让 UI 用错误样式呈现。
  if (ak?.qilin_error_fallback === true) {
    next.status = "error";
    const fallbackContent = msg.content;
    next.error =
      typeof fallbackContent === "string" && fallbackContent
        ? fallbackContent
        : "引擎处理出错";
    return next;
  }

  // 正文增量（空 content 忽略：values 快照补发的空 content 不影响）
  const content = msg.content;
  if (typeof content === "string" && content) {
    next.text = (next.text ?? "") + content;
  }

  // reasoning 流：兼容 reasoning_content（DeepSeek/o1）与 reasoning（其他 provider）
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
      toolCalls as Array<Record<string, unknown>>,
      now
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
  msg: Record<string, unknown>,
  now: number
): AssistantTurnState {
  const toolCallId = msg.tool_call_id as string | undefined;
  const isClarification = isClarificationToolMessage(msg);
  if (!toolCallId && !isClarification) return state;
  const calls = state.toolCalls ?? [];
  const idx = toolCallId ? calls.findIndex((tc) => tc.id === toolCallId) : -1;
  if (idx < 0 && !isClarification) return state; // 无匹配的 tool_call（可能来自 hide_from_ui 的调用），忽略

  const content = msg.content;
  const resultStr =
    typeof content === "string" ? content : JSON.stringify(content ?? "");
  const updated = [...calls];
  if (idx >= 0) {
    updated[idx] = {
      ...updated[idx],
      result: resultStr,
      artifact: msg.artifact,
      status: "done",
      endedAt: now
    };
  } else {
    updated.push(clarificationToolCallFromMessage(msg, resultStr, now));
  }
  const toolName = idx >= 0 ? updated[idx].name : updated[updated.length - 1]?.name;
  const derivedArtifacts = artifactsFromToolResult(toolName, resultStr, msg.artifact);
  return {
    ...state,
    ...(isClarification ? { status: "needs_input" as const } : {}),
    ...(!state.text && resultStr && isClarification ? { text: resultStr } : {}),
    ...(derivedArtifacts.length > 0 ? { artifacts: mergeArtifacts(state.artifacts, derivedArtifacts) } : {}),
    toolCalls: updated
  };
}

function mergeToolCalls(
  existing: ToolCall[],
  incoming: Array<Record<string, unknown>>,
  now?: number
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
      // 已存在调用保留原状态（tool message 回填 done 后，ai 帧重发不得重置为 running）
      status: prev?.status ?? "running",
      ...(now != null ? { startedAt: prev?.startedAt ?? now } : {})
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
  data: unknown,
  now: number
): AssistantTurnState {
  if (!data || typeof data !== "object") return state;
  const ev = data as Record<string, unknown>;
  const type = ev.type as string;

  switch (type) {
    case "task_started":
      return reduceTaskStarted(state, ev);
    case "task_running":
      return reduceTaskRunning(state, ev, now);
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
  ev: Record<string, unknown>,
  now: number
): AssistantTurnState {
  const taskId = ev.task_id as string | undefined;
  if (!taskId) return state;
  const subs = state.subagents ?? [];
  const idx = subs.findIndex((s) => s.taskId === taskId);
  if (idx < 0) return state;

  const message = ev.message as Record<string, unknown> | undefined;
  const index = numOr(ev.message_index, subs[idx].steps.length + 1);

  // subagent 工具结果（ToolMessage）：按 tool_call_id 回填对应 step 的调用，
  // 否则残留的调用永远保持 running（回归：任务完成后工具调用仍显示处理中）。
  const toolCallId =
    message && typeof message.tool_call_id === "string" ? message.tool_call_id : "";
  if (toolCallId && message) {
    return backfillSubagentToolResult(state, subs, idx, toolCallId, message, now);
  }

  const step: SubagentStep = { index };
  if (message && typeof message.content === "string") {
    step.text = message.content;
  }
  if (message && Array.isArray(message.tool_calls)) {
    // 同 step 重放时保留已有 toolCalls（避免已回填的调用被重置为 running）
    const prevStep = subs[idx].steps.find((s) => s.index === index);
    step.toolCalls = mergeToolCalls(
      prevStep?.toolCalls ?? [],
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

/** 回填 subagent 某次工具调用结果（task_running 携带的 ToolMessage）。 */
function backfillSubagentToolResult(
  state: AssistantTurnState,
  subs: SubagentTask[],
  taskIdx: number,
  toolCallId: string,
  message: Record<string, unknown>,
  now: number
): AssistantTurnState {
  const content = message.content;
  const resultStr =
    typeof content === "string" ? content : JSON.stringify(content ?? "");
  const updated = [...subs];
  updated[taskIdx] = {
    ...updated[taskIdx],
    steps: updated[taskIdx].steps.map((step) => {
      const calls = step.toolCalls;
      if (!calls || !calls.some((tc) => tc.id === toolCallId)) return step;
      return {
        ...step,
        toolCalls: calls.map((tc) =>
          tc.id === toolCallId
            ? {
                ...tc,
                result: resultStr,
                artifact: message.artifact,
                status: "done",
                endedAt: now
              }
            : tc
        )
      };
    })
  };
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
  if (Array.isArray(snap.todos)) {
    next.todos = snap.todos
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item): TodoItem => ({
        content: typeof item.content === "string" ? item.content : "",
        status:
          item.status === "in_progress" || item.status === "completed"
            ? item.status
            : "pending"
      }))
      .filter((item) => item.content.trim().length > 0);
  }

  // 技能上下文：任务实际读取过的技能（浮动面板技能数与此匹配）
  if (Array.isArray(snap.skill_context)) {
    next.skills = snap.skill_context
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item) => (typeof item.name === "string" ? item.name : ""))
      .filter((name) => name.trim().length > 0);
  }

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
  if (next.status !== "compacted") {
    next.status = hasHumanInputToolCall(next.toolCalls) ? "needs_input" : "done";
  }

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

  if (next.toolCalls?.some((call) => call.status === "running")) {
    next.toolCalls = next.toolCalls.map((call) =>
      call.status === "running" ? { ...call, status: "done", endedAt: now } : call
    );
  }

  // subagent 步骤内的工具调用同样收尾（turn 结束时不得残留 running）
  if (
    next.subagents?.some((task) =>
      task.steps.some((step) => step.toolCalls?.some((call) => call.status === "running"))
    )
  ) {
    next.subagents = next.subagents.map((task) => ({
      ...task,
      steps: task.steps.map((step) => ({
        ...step,
        toolCalls: step.toolCalls?.map((call) =>
          call.status === "running" ? { ...call, status: "done", endedAt: now } : call
        )
      }))
    }));
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

function clarificationToolCallFromMessage(
  msg: Record<string, unknown>,
  resultStr: string,
  now: number
): ToolCall {
  return {
    id: String(msg.tool_call_id || msg.id || `ask_clarification:${now}`),
    name: typeof msg.name === "string" && msg.name ? msg.name : "ask_clarification",
    args: {},
    result: resultStr,
    artifact: msg.artifact,
    status: "done",
    endedAt: now
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

function artifactsFromToolResult(
  toolName: string | undefined,
  resultStr: string,
  artifact: unknown
): unknown[] {
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

  if (isReportRenderTool(toolName) && artifacts.length === 0) {
    artifacts.push("/outputs/report.html");
  }
  return mergeArtifacts([], artifacts);
}

function isReportRenderTool(toolName: string | undefined): boolean {
  return toolName === "render_html_report" || toolName === "render_html_report_from_file";
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
