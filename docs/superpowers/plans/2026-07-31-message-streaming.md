# 消息流式打通方案

## 架构决策（已与用户确认）

- **后端**：前端直连引擎网关（`vendor/qilin/app/gateway`，已挂载）。零新 BFF 路由。引擎已提供 `POST /api/v1/threads`、`POST /api/v1/threads/{id}/runs/stream`（SSE）、`GET /api/v1/threads/{id}/messages`、`POST /threads/{id}/compact`、`POST /threads/{id}/branches`。
- **会话真源**：保留 localStorage `sessionStore`，给 `ChatSession` 加 `threadId`。首次发消息时 `POST /threads` 创建引擎 thread 并绑定；切回旧 session 时用 `GET /threads/{id}/messages` 懒加载历史。
- **模型配置对接**：`RunCreateRequest.context = { model_name, thinking_enabled, reasoning_effort }`，由前端 `turnsClient` 从 `activeModel` + 模型能力位注入。

## 引擎 SSE 协议（已调研确认，作为 client 实现依据）

wire format：`event: <type>\ndata: <json>\nid: <opt>\n\n`（与 LangGraph `useStream` 兼容）。
`stream_mode = ["values", "messages-tuple", "custom"]` 时出现的 chunk：

| event | data 形态 | 前端用途 |
|-------|----------|---------|
| `messages-tuple` | `{type:"ai", content:<delta>, id}` | AI 正文流式累加 |
| `messages-tuple` | `{type:"ai", content:"", id, tool_calls:[...]}` | 工具调用请求 |
| `messages-tuple` | `{type:"ai", content:"", id, additional_kwargs:{reasoning_content}}` | **reasoning 流**（思考内容） |
| `messages-tuple` | `{type:"ai", content:<delta>, id, usage_metadata}` | 用量 |
| `messages-tuple` | `{type:"tool", content, name, tool_call_id, id, artifact?}` | 工具结果（回填 tool_call） |
| `custom` | `{type:"task_started"\|"task_running"\|"task_completed"\|"task_failed", task_id, description?, step?, model_name?}` | **并行 subagent 按 task_id 分组** |
| `custom` | `subagent.start`/`subagent.step`/`subagent.end`、`middleware:guardrail\|skill_activation` 等 | 阶段推断/护栏提示 |
| `values` | `{title, messages:[...], artifacts:[...]}` | 标题/产物；messages 收缩 = compaction |
| `end` | `{usage:{input,output,total}}` | turn 完成 |
| `gap` | `{code:"stream_replay_gap",...}` | 断点，提示重载 |

关键约束（来自 `vendor/qilin/qilin/client.py` L804-810）：`additional_kwargs` 是**增量**（已发过的 key 不重发）；同一 msg_id 的最终 `values` 快照可能补发空 content + additional_kwargs 元数据，前端按 msg_id 合并、空 content 忽略。

---

## Task 1：sessionStore turn-based 重构

**Files**: `apps/desktop/src/lib/sessionStore.ts`（改）, `apps/desktop/tests/App.spec.tsx`（适配）

当前 `ChatMessage` 仅 `{id,role,content,createdAt,model?}` + `synthesizeAssistantReply` 假桩。重构为 turn-based：

```ts
export type ChatRole = "user" | "assistant";
export interface ReasoningBlock { text: string; startedAt: number; endedAt?: number; }
export interface ToolCall {
  id: string; name: string; args: Record<string, unknown>;
  status: "running" | "done" | "error"; result?: string; artifact?: unknown;
}
export interface SubagentTask {
  taskId: string; description?: string; model?: string;
  status: "running" | "completed" | "failed" | "cancelled" | "timed_out";
  steps: ToolCall[];
}
export interface ChatMessage {
  id: string; role: ChatRole; createdAt: string; model?: string;
  // user
  content?: string;
  // assistant（流式累积）
  text?: string;
  reasoning?: ReasoningBlock;
  toolCalls?: ToolCall[];
  subagents?: SubagentTask[];
  stage?: string;                    // pipeline_stage（推断）
  status?: "streaming" | "done" | "error" | "compacted";
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  thinkingMs?: number;               // reasoning 耗时（完成后填）
  error?: string;
}
export interface ChatSession {
  id: string; title: string; createdAt: string; updatedAt: string;
  threadId?: string;                 // 引擎 thread（首次发消息绑定）
  messages: ChatMessage[];
  reportMarkdown: string; activeSkills: string[];
}
```

保留 `createSession`/`createSeedSessions`/`appendMessageToSession` 签名兼容（seed session 无 threadId，发消息时 lazy 绑定）。移除 `synthesizeAssistantReply` 假桩（Task 9 接入真实 run 后不再需要）。

**测试**：turn-based 结构序列化/反序列化、appendMessage 兼容、threadId 绑定。

---

## Task 2：sseParser + turnsClient

**Files**: `apps/desktop/src/lib/sseParser.ts`（新）, `apps/desktop/src/lib/turnsClient.ts`（新）, `apps/desktop/tests/turnsClient.spec.ts`（新）

**sseParser.ts**（纯函数，易测）：
```ts
export interface SseFrame { event: string; data: unknown; id?: string; }
/** 把 ReadableStream<uint8> 转成 AsyncIterable<SseFrame>，按 \n\n 分帧。 */
export async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncIterable<SseFrame>
```

**turnsClient.ts**：
```ts
import { GATEWAY_URL, readCsrfToken } from "./gatewayUrl";
export interface RunContext { model_name: string; thinking_enabled: boolean; reasoning_effort?: string; }
export interface StreamRunHandlers {
  onFrame: (f: SseFrame) => void;   // 交给 turnReducer
  onError: (e: Error) => void;
}
export async function ensureThread(): Promise<string>            // POST /api/v1/threads，返回 thread_id
export async function streamRun(opts: {
  threadId: string; input: { messages: { role: "user"; content: string }[] };
  context: RunContext; signal?: AbortSignal; handlers: StreamRunHandlers;
}): Promise<void>
```

实现要点：
- `fetch(GATEWAY_URL + "/api/v1/threads/" + threadId + "/runs/stream", { method:"POST", credentials:"include", headers:{"Content-Type":"application/json","X-CSRF-Token": readCsrfToken()!, "Accept":"text/event-stream"}, body: JSON.stringify({ input, context, stream_mode:["values","messages-tuple","custom"] }), signal })`
- 读 `response.body` 喂 `parseSseStream`，每帧 `onFrame`；遇 `event:"end"` 或流结束 resolve；遇 `event:"error"`/网络错误 `onError`。
- 用 `AbortController` 支持「停止生成」。
- **CSRF 验证**（关键风险点）：引擎 `csrf_middleware.py` 对 POST 校验 `X-CSRF-Token`。fetch POST 可加自定义 header（不像 EventSource），理论可行。若实测被拒（如对 `text/event-stream` Accept 有特殊处理），在 `scripts/run_gateway.py` 的 `_configure_gateway_security` 或 CSRF 配置层放行 `/api/v1/threads/.*/runs/stream`（**不改 vendor**）。此验证放本 Task 首位。

**测试**：mock fetch + ReadableStream 喂构造的 SSE 字节流，断言 ensureThread/streamRun 正确解析帧、注入 context、带 CSRF header、abort 生效。

---

## Task 3：turnReducer（SSE chunk → assistant turn 状态）

**Files**: `apps/desktop/src/lib/turnReducer.ts`（新）, `apps/desktop/tests/turnReducer.spec.ts`（新）

纯函数 reducer，是 UI 流式的核心：
```ts
export interface AssistantTurnState extends Partial<ChatMessage> {}
export function reduceFrame(state: AssistantTurnState, frame: SseFrame, now: number): AssistantTurnState
export function initialTurn(): AssistantTurnState
```

规则（对应协议表）：
- `messages-tuple` ai `content` 非空 → `state.text += content`，记录 `msgId`
- `messages-tuple` ai `additional_kwargs.reasoning_content` → 若无 `reasoning` 则建（`startedAt=now`），`reasoning.text += ...`
- `messages-tuple` ai `tool_calls` → 合并进 `toolCalls[]`（按 `id`，status="running"）；**首个 tool_call 时刻 = reasoning 结束**（若有 reasoning 且无 endedAt，填 `endedAt`）
- `messages-tuple` tool → 按 `tool_call_id` 找到 toolCall，回填 `result`/`artifact`/`status="done"`
- `custom` `task_started` → `subagents.push({taskId, description, model, status:"running", steps:[]})`
- `custom` `task_running` → 找 `taskId` 的 subagent，`steps.push(step)`（step 即子工具调用）
- `custom` `task_completed/failed/cancelled/timed_out` → subagent.status 更新
- `values` → 更新 `title`/`artifacts`；**检测 compaction**：若 `data.messages` 长度小于已处理计数，或出现 `RemoveMessage` 标记 → 当前 turn 标 `status="compacted"`（保留已渲染内容，UI 加压缩标注）
- `end` → `status="done"`，填 `usage`，若 reasoning 仍未 endedAt 则用 now 收尾，算 `thinkingMs = endedAt - startedAt`
- `error`/`gap` → `status="error"`/`error` 字段

**测试**（核心，覆盖各 chunk 组合）：文本流累积、reasoning 起止计时、tool_call 请求+结果回填、task_id 并行分组、compaction 检测、end 收尾。这是整个流式正确性的基石。

---

## Task 4：stageInferrer（pipeline_stage 前端推断兜底）

**Files**: `apps/desktop/src/lib/stageInferrer.ts`（新）, `apps/desktop/tests/stageInferrer.spec.ts`（新）

用户明确「前端推断兜底」（引擎无直接 pipeline_stage 字段）：
```ts
export function inferStage(prev: string | undefined, frame: SseFrame): string
```

映射表（可后续调整词汇）：
- `run.start` / 初始 → "准备"
- `task_started`/`task_running`（description 含"搜索"/"检索"/"news"）→ "检索资料"
- `tool_calls`（name 含 financial/statement/valuation/industry）→ "数据分析"
- `values.artifacts` 非空 → "撰写报告"
- `end` → "完成"
- 兜底：未命中则沿用 `prev`

**测试**：各事件→阶段映射、兜底沿用。

---

## Task 5：ChatFeed + UserBubble（turn 聚合骨架）

**Files**: `apps/desktop/src/components/ChatFeed.tsx`（新）

Claude/ChatGPT 风格：user 右对齐气泡；assistant 无气泡、左带头像、内容栈（reasoning/subagents/tools/text）垂直排列。
```tsx
export function ChatFeed({ messages, streamingId }: { messages: ChatMessage[]; streamingId?: string })
```
- user → `<UserBubble>`
- assistant → `<AssistantTurn msg stage 流式高亮>`（Task 8 实现）
- 空状态沿用现有 empty-state 文案
- 自动滚动到底（流式时跟随，用户上滚时暂停跟随——用 `scrollTop` 阈值判断）

---

## Task 6：ReasoningBlock（流式展开 + 完成折叠）

**Files**: `apps/desktop/src/components/ReasoningBlock.tsx`（新）

- 流式中（`status==="streaming"` 且 reasoning 无 endedAt）：带头像 + `reasoning.text` 流式输出（等宽/斜体区分正文），标题"思考中…"
- 完成后（有 `endedAt`）：折叠为单条「已思考 Ns」（N = thinkingMs/1000，四舍五入；<1s 显示"已思考 <1s"），点击可展开查看全文
- 无 reasoning 的 turn 不渲染本块

---

## Task 7：ToolCard + SubagentGroup（task_id 分组）

**Files**: `apps/desktop/src/components/ToolCard.tsx`（新）, `apps/desktop/src/components/SubagentGroup.tsx`（新）

**ToolCard**：紧凑卡片——`name` + args 摘要（首行 key=value）+ 状态点（running 旋转/done 勾/error 叉）+ 可展开 result（截断 + "展开"）。
**SubagentGroup**：按 `taskId` 分组（引擎同 turn 可并行多个 subagent）。每组：标题行（description + model + status 徽章）+ 嵌套该 task 的 steps（用 ToolCard 渲染）。多个 group 横向排列或纵向堆叠（CSS grid/flex，移动端纵向）。

---

## Task 8：AssistantTurn 整合

**Files**: `apps/desktop/src/components/AssistantTurn.tsx`（新）, `apps/desktop/src/components/StageBadge.tsx`（新）

```tsx
export function AssistantTurn({ msg, isStreaming }: { msg: ChatMessage; isStreaming?: boolean })
```
布局（从上到下）：头像 + StageBadge（pipeline_stage）→ ReasoningBlock → SubagentGroup[] → ToolCard[]（主 agent 的 toolCalls）→ 正文 `msg.text`（markdown 渲染，复用现有 `lib/markdown.ts`）→ 用量 chip + CompactedNotice（`status==="compacted"` 时显示「上下文已压缩」）+ error 提示。流式时整 turn 末尾闪动光标。

---

## Task 9：WorkspaceShell 接入真实 run

**Files**: `apps/desktop/src/pages/Home.tsx`（改 WorkspaceShell）, `apps/desktop/tests/App.spec.tsx`（适配）

改造 `handleSend(model)`：
1. append user message（带 model）
2. 若 `session.threadId` 缺失 → `ensureThread()`，写回 session.threadId（localStorage 持久化）
3. append 空 assistant turn（`status:"streaming"`），记 `streamingId`
4. `streamRun({ threadId, input:{messages:[{role:"user",content}]}, context: runContextFromModel(model, models), handlers:{ onFrame: f => setSession(reduceTurn(f)), onError: ... } })`
5. `context` 映射：`model_name=model.name`，`thinking_enabled=model.supports_thinking`，`reasoning_effort` 暂不传（后续按需）
6. 「停止」按钮 → `AbortController.abort()`
7. 切换 session 时若 `threadId` 存在且 messages 空 → `GET /threads/{id}/messages` 懒加载（turnsClient 加 `loadHistory(threadId)`，把引擎 messages 转成 ChatMessage[]）

移除 `synthesizeAssistantReply` 调用与 `buildReportMarkdown` 假桩（报告改为从 turn 的 artifacts 真实来源，或保留空）。

**测试**：mock turnsClient，断言发消息→创建 assistant streaming turn→帧到达后 text/reasoning/tool 更新→end 后 status=done；threadId 持久化；停止按钮 abort。

---

## Task 10：死代码清理 + 对话流样式

**Files**: `apps/desktop/src/components/ChatPanel.tsx`（**删**）, `apps/desktop/src/lib/gatewayTypes.ts`（清 Sidecar*，留 WorkspaceInfo/ThreadCreateResult/ArtifactListResult 并补 SSE/turn 类型导出）, `apps/desktop/src/styles.css`（追加对话流 CSS）

CSS 要点（Claude/ChatGPT 风）：
- user 气泡：右对齐、主题色背景、圆角、max-width 70%
- assistant turn：无背景、左 padding 留头像位、头像 24px 圆形、内容区 `gap: 12px` 垂直栈
- reasoning：浅灰背景/斜体、折叠态单行「已思考 Ns」hover 可点
- toolcard：1px 边框、圆角 8px、紧凑 padding、状态点 8px
- stage badge：小号 chip、低饱和色
- 流式光标：`::after` 闪烁竖线

---

## Task 11：端到端验证（Playwright）

启动 gateway + Vite，浏览器实测：注册→工作台→选模型→发消息→观察 AI 文本流式出现、reasoning 流式后折叠为"已思考 Ns"、工具调用卡片出现并回填结果、stage 徽章变化、完成显示用量、停止按钮生效。无真实 API key 时用本地 mock 模型或仅验证流式协议握手（视模型配置情况）。补充 curl 直连 `/runs/stream` 验证 SSE 帧序列与文档一致。

---

## Task 12：文档

- `docs/配置说明.md`：补「对话与流式」节（SSE 协议、stream_mode、context 注入、task_id 分组、compaction 信号）
- `docs/运行说明.md`：运行测试补 turnsClient/turnReducer/stageInferrer 的 vitest
- `docs/开发进度.md`：新增「阶段四：消息流式打通」
- `docs/superpowers/plans/2026-07-31-message-streaming.md`：本 plan 落盘

---

## 关键风险与缓解

| 风险 | 缓解 |
|------|------|
| CSRF middleware 拒绝 SSE POST | Task 2 首位验证；必要时 run_gateway.py 放行 runs/stream（不改 vendor） |
| reasoning 字段因 provider 而异（DeepSeek reasoning_content vs 其他） | reducer 同时认 `additional_kwargs.reasoning_content` 与 `additional_kwargs.reasoning`，兜底 |
| compaction 信号不可靠 | 检测 values.messages 收缩 + RemoveMessage 双信号；不确定时不标注（宁漏勿错） |
| localStorage 旧 session 无 threadId 且结构变 | seed session 兼容；appendMessage 保持签名；旧数据无 threadId 时 lazy 创建 |
| SSE 在 Tauri webview 下 fetch streaming | 验证 webview 支持 ReadableStream；Tauri 与浏览器同源策略已由 CORS origin 覆盖 |

## 文件清单汇总

**新建（10）**：`lib/sseParser.ts` `lib/turnsClient.ts` `lib/turnReducer.ts` `lib/stageInferrer.ts` `components/ChatFeed.tsx` `components/ReasoningBlock.tsx` `components/ToolCard.tsx` `components/SubagentGroup.tsx` `components/AssistantTurn.tsx` `components/StageBadge.tsx` + 3 个 spec
**修改（5）**：`lib/sessionStore.ts` `lib/gatewayTypes.ts` `pages/Home.tsx` `styles.css` `tests/App.spec.tsx`
**删除（1）**：`components/ChatPanel.tsx`
**文档（4）**：配置说明/运行说明/开发进度/本 plan
