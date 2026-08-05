# User Message Edit And Resend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent edit and copy actions to user messages, and resend edited text from a real QiLin thread branch with checkpoint-correct edit regeneration.

**Architecture:** The desktop client first branches at the completed assistant turn following the selected user message, then calls QiLin's edit-regenerate prepare endpoint on that branch and streams the returned input/checkpoint/metadata. Message identity is preserved from local send through engine history, while a focused `editResend` module owns anchor resolution, prepared-input cleanup, branch cleanup, and local branch-session construction.

**Tech Stack:** React 18, TypeScript, Vitest, React Testing Library, Lucide React, QiLin REST/SSE gateway, Vite.

---

## File Map

- Modify `apps/desktop/src/lib/turnsClient.ts`: typed branch/edit-regenerate APIs and checkpoint/metadata-aware streaming.
- Modify `apps/desktop/tests/turnsClient.spec.ts`: request/response and stream payload coverage.
- Modify `apps/desktop/src/lib/sessionStore.ts`: stable user message IDs and assistant engine message ID storage.
- Modify `apps/desktop/src/lib/engineHistory.ts`: collect every assistant engine message ID in a merged turn.
- Modify `apps/desktop/src/lib/turnReducer.ts`: collect assistant IDs from live SSE message frames.
- Modify `apps/desktop/tests/sessionStore.spec.ts`, `engineHistory.spec.ts`, and `turnReducer.spec.ts`: identity regressions.
- Create `apps/desktop/src/lib/editResend.ts`: editable-turn resolution, two-stage branch preparation, attachment stripping, cleanup, and branch-session construction.
- Create `apps/desktop/tests/editResend.spec.ts`: pure workflow and failure recovery tests.
- Modify `apps/desktop/src/components/UserBubble.tsx`: copy feedback and inline editing UI.
- Create `apps/desktop/tests/UserBubble.spec.tsx`: component interaction tests.
- Modify `apps/desktop/src/components/ChatFeed.tsx`: pass edit capability and async callback to each user bubble.
- Create `apps/desktop/tests/ChatFeed.spec.tsx`: callback routing and editability tests.
- Modify `apps/desktop/src/pages/Home.tsx`: stable-ID sends, shared stream runner, edit-resend orchestration, and branch switching.
- Modify `apps/desktop/src/styles.css`: compact action row and inline editor styles.

### Task 1: Add Typed Branch And Edit-Regenerate Gateway APIs

**Files:**
- Modify: `apps/desktop/src/lib/turnsClient.ts`
- Test: `apps/desktop/tests/turnsClient.spec.ts`

- [ ] **Step 1: Write failing API-client tests**

Add imports for `createThreadBranch` and `prepareEditRegenerate`, then add tests that assert exact URL, CSRF headers, body, response mapping, and error handling. Extend the existing `streamRun` body test to include checkpoint and metadata:

```ts
it("创建 thread 分支并返回新 thread id", async () => {
  fetchMock.mockResolvedValue(makeMockResponse({
    json: {
      thread_id: "branch-1",
      parent_thread_id: "thr-1",
      parent_checkpoint_id: "cp-1",
      branched_from_message_id: "ai-final",
      workspace_clone_mode: "skipped_historical_turn",
      history_seed_mode: "seeded"
    }
  }));

  const result = await createThreadBranch("thr-1", {
    message_id: "ai-final",
    message_ids: ["ai-tool", "ai-final"],
    title: "分析任务（编辑）"
  });

  expect(result.thread_id).toBe("branch-1");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("http://localhost:18001/api/threads/thr-1/branches");
  expect(init.headers["X-CSRF-Token"]).toBe("test-csrf-abc");
  expect(JSON.parse(init.body)).toEqual({
    message_id: "ai-final",
    message_ids: ["ai-tool", "ai-final"],
    title: "分析任务（编辑）"
  });
});

it("准备编辑重跑并保留 checkpoint 与 metadata", async () => {
  const response = {
    input: {
      messages: [{
        type: "human",
        id: "human-replacement",
        content: [{ type: "text", text: "修改后的问题" }],
        additional_kwargs: { files: [{ filename: "old.pdf" }] }
      }]
    },
    checkpoint: { checkpoint_ns: "", checkpoint_id: "cp-base" },
    metadata: { replay_kind: "edit", regenerate_from_run_id: "run-old" },
    target_run_id: "run-old",
    replacement_human_message_id: "human-replacement",
    source_message_ids: ["human-old", "ai-final"]
  };
  fetchMock.mockResolvedValue(makeMockResponse({ json: response }));

  await expect(
    prepareEditRegenerate("branch-1", "human-old", "修改后的问题")
  ).resolves.toEqual(response);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("http://localhost:18001/api/threads/branch-1/runs/edit-regenerate/prepare");
  expect(JSON.parse(init.body)).toEqual({
    human_message_id: "human-old",
    replacement_text: "修改后的问题"
  });
});

it("streamRun 透传 checkpoint 与 metadata", async () => {
  const opts = {
    ...makeRunOpts(),
    checkpoint: { checkpoint_ns: "", checkpoint_id: "cp-base" },
    metadata: { replay_kind: "edit" }
  };
  fetchMock.mockResolvedValue(streamResponse(["event: end\ndata: null\n\n"]));
  await streamRun(opts);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.checkpoint).toEqual(opts.checkpoint);
  expect(body.metadata).toEqual(opts.metadata);
});

it("branch 与 edit prepare 的非 2xx 响应抛出 detail", async () => {
  fetchMock.mockResolvedValueOnce(
    makeMockResponse({ ok: false, status: 409, json: { detail: "cannot branch" } })
  );
  await expect(createThreadBranch("thr-1", {
    message_id: "ai-final",
    message_ids: ["ai-final"]
  })).rejects.toThrow(/cannot branch/);

  fetchMock.mockResolvedValueOnce(
    makeMockResponse({ ok: false, status: 409, json: { detail: "cannot edit" } })
  );
  await expect(
    prepareEditRegenerate("branch-1", "human-1", "新问题")
  ).rejects.toThrow(/cannot edit/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm --prefix apps/desktop test -- turnsClient.spec.ts`

Expected: FAIL because the two API functions and stream options do not exist.

- [ ] **Step 3: Implement the typed contracts and requests**

Add these public contracts and functions, using the existing `jsonHeaders()` and `toError()` helpers:

```ts
export interface ThreadBranchRequest {
  message_id: string;
  message_ids: string[];
  title?: string;
}

export interface ThreadBranchResponse {
  thread_id: string;
  parent_thread_id: string;
  parent_checkpoint_id: string;
  branched_from_message_id: string;
  workspace_clone_mode: string;
  history_seed_mode: string;
}

export interface RunCheckpoint {
  checkpoint_ns: string;
  checkpoint_id: string;
  checkpoint_map?: Record<string, unknown>;
}

export interface RunInputMessage {
  role?: "user";
  type?: "human";
  id?: string;
  content: string | Array<{ type: "text"; text: string }>;
  additional_kwargs?: Record<string, unknown>;
}

export interface RunInput {
  messages: RunInputMessage[];
  title?: string;
}

export interface EditRegeneratePrepareResponse {
  input: RunInput;
  checkpoint: RunCheckpoint;
  metadata: Record<string, unknown>;
  target_run_id: string;
  replacement_human_message_id: string;
  source_message_ids: string[];
}

export async function createThreadBranch(
  threadId: string,
  body: ThreadBranchRequest
): Promise<ThreadBranchResponse> {
  const resp = await fetch(`${GATEWAY_URL}/api/threads/${encodeURIComponent(threadId)}/branches`, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw await toError("创建会话分支失败", resp);
  return (await resp.json()) as ThreadBranchResponse;
}

export async function prepareEditRegenerate(
  threadId: string,
  humanMessageId: string,
  replacementText: string
): Promise<EditRegeneratePrepareResponse> {
  const resp = await fetch(
    `${GATEWAY_URL}/api/threads/${encodeURIComponent(threadId)}/runs/edit-regenerate/prepare`,
    {
      method: "POST",
      credentials: "include",
      headers: jsonHeaders(),
      body: JSON.stringify({
        human_message_id: humanMessageId,
        replacement_text: replacementText
      })
    }
  );
  if (!resp.ok) throw await toError("准备编辑重发失败", resp);
  return (await resp.json()) as EditRegeneratePrepareResponse;
}
```

Change `StreamRunOptions.input` to `RunInput`, add optional `checkpoint` and `metadata`, and include both in the JSON body only when supplied.

- [ ] **Step 4: Run API tests**

Run: `npm --prefix apps/desktop test -- turnsClient.spec.ts`

Expected: all `turnsClient` tests PASS.

- [ ] **Step 5: Commit the API layer**

```bash
git add apps/desktop/src/lib/turnsClient.ts apps/desktop/tests/turnsClient.spec.ts
git commit -m "feat: add edit resend gateway APIs"
```

### Task 2: Preserve User And Assistant Engine Message IDs

**Files:**
- Modify: `apps/desktop/src/lib/sessionStore.ts`
- Modify: `apps/desktop/src/lib/engineHistory.ts`
- Modify: `apps/desktop/src/lib/turnReducer.ts`
- Test: `apps/desktop/tests/sessionStore.spec.ts`
- Test: `apps/desktop/tests/engineHistory.spec.ts`
- Test: `apps/desktop/tests/turnReducer.spec.ts`

- [ ] **Step 1: Write failing identity tests**

Add these focused assertions:

```ts
it("appendMessageToSession 接受预生成的 user message id", () => {
  const session = appendMessageToSession(createSession(), "user", "问题", "model-a", "human-1");
  expect(session.messages[0].id).toBe("human-1");
});

it("同一 run 合并 assistant 消息时保留全部引擎消息 id", () => {
  const out = engineMessagesToChatMessages([
    { type: "human", id: "human-1", content: "问题", run_id: "run-1" },
    { type: "ai", id: "ai-tool", content: "处理中", run_id: "run-1" },
    { type: "ai", id: "ai-final", content: "完成", run_id: "run-1" }
  ]);
  expect(out[1].engineMessageIds).toEqual(["ai-tool", "ai-final"]);
});

it("流式 assistant 帧按首次出现顺序去重引擎消息 id", () => {
  let state = reduceFrame(initialTurn(), frame("messages", aiMsg({ id: "ai-1", content: "A" })), 1);
  state = reduceFrame(state, frame("messages", aiMsg({ id: "ai-1", content: "B" })), 2);
  state = reduceFrame(state, frame("messages", aiMsg({ id: "ai-2", content: "C" })), 3);
  expect(state.engineMessageIds).toEqual(["ai-1", "ai-2"]);
});
```

- [ ] **Step 2: Run identity tests and verify failure**

Run: `npm --prefix apps/desktop test -- sessionStore.spec.ts engineHistory.spec.ts turnReducer.spec.ts`

Expected: FAIL because `engineMessageIds` and explicit user IDs are not implemented.

- [ ] **Step 3: Add the identity fields and merge behavior**

Add `engineMessageIds?: string[]` to `ChatMessage`. Extend `appendMessageToSession` with an optional final `messageId` argument and use it instead of generating another UUID.

In `engineHistory.ts`, initialize assistant turns with the engine ID and union IDs when turns merge:

```ts
const engineId = typeof msg.id === "string" && msg.id ? msg.id : undefined;
const turn: ChatMessage = {
  id: ensureId(engineId),
  role: "assistant",
  createdAt: ensureTimestamp(row, msg),
  status: errorText ? "error" : "done",
  ...(engineId ? { engineMessageIds: [engineId] } : {}),
  ...(typeof row.run_id === "string" && row.run_id ? { runId: row.run_id } : {}),
  ...(text ? { text } : {}),
  ...(reasoning ? { reasoning } : {}),
  ...(toolCalls.length > 0 ? { toolCalls } : {}),
  ...(usage ? { usage } : {}),
  ...(errorText ? { error: errorText } : {})
};

target.engineMessageIds = uniqueIds([
  ...(target.engineMessageIds ?? []),
  ...(incoming.engineMessageIds ?? [])
]);
```

In `turnReducer.ts`, record a visible AI frame's string `id` before processing error/text/reasoning/tool fields:

```ts
const engineId = typeof msg.id === "string" && msg.id ? msg.id : undefined;
if (engineId && !next.engineMessageIds?.includes(engineId)) {
  next.engineMessageIds = [...(next.engineMessageIds ?? []), engineId];
}
```

- [ ] **Step 4: Run identity tests**

Run: `npm --prefix apps/desktop test -- sessionStore.spec.ts engineHistory.spec.ts turnReducer.spec.ts`

Expected: all focused tests PASS.

- [ ] **Step 5: Commit message identity support**

```bash
git add apps/desktop/src/lib/sessionStore.ts apps/desktop/src/lib/engineHistory.ts apps/desktop/src/lib/turnReducer.ts apps/desktop/tests/sessionStore.spec.ts apps/desktop/tests/engineHistory.spec.ts apps/desktop/tests/turnReducer.spec.ts
git commit -m "feat: preserve engine message identities"
```

### Task 3: Implement The Edit-Resend Workflow Module

**Files:**
- Create: `apps/desktop/src/lib/editResend.ts`
- Create: `apps/desktop/tests/editResend.spec.ts`

- [ ] **Step 1: Write failing workflow tests**

Cover anchor resolution, disabled incomplete turns, API ordering, attachment removal, cleanup, and local session construction:

```ts
it("从用户消息定位紧邻的已完成 assistant turn", () => {
  const target = resolveEditableTurn(messages, "human-1");
  expect(target.userIndex).toBe(0);
  expect(target.assistantMessageIds).toEqual(["ai-tool", "ai-final"]);
  expect(target.primaryAssistantMessageId).toBe("ai-final");
});

it("assistant 未完成或缺少引擎 id 时不可编辑", () => {
  expect(() => resolveEditableTurn(streamingMessages, "human-1")).toThrow(/尚未完成/);
  expect(() => resolveEditableTurn(noEngineIds, "human-1")).toThrow(/消息标识/);
});

it("先创建分支再准备编辑重跑，并移除历史附件", async () => {
  const calls: string[] = [];
  const result = await prepareEditedBranch({
    sourceSession,
    userMessageId: "human-1",
    replacementText: "新问题",
    api: {
      createBranch: async () => {
        calls.push("branch");
        return branchResponse;
      },
      prepareEdit: async () => {
        calls.push("prepare");
        return preparedResponseWithFiles;
      },
      deleteThread: async () => calls.push("delete")
    }
  });
  expect(calls).toEqual(["branch", "prepare"]);
  expect(result.prepared.input.messages[0].additional_kwargs).toEqual({});
});

it("prepare 失败时清理新建分支并保留原错误", async () => {
  const deleteThread = vi.fn().mockResolvedValue(undefined);
  const failure = new Error("prepare failed");
  await expect(prepareEditedBranch({
    sourceSession,
    userMessageId: "human-1",
    replacementText: "新问题",
    api: {
      createBranch: async () => branchResponse,
      prepareEdit: async () => { throw failure; },
      deleteThread
    }
  })).rejects.toBe(failure);
  expect(deleteThread).toHaveBeenCalledWith("branch-1");
});

it("构造的新 session 截断原轮并使用后端生成的新 human id", () => {
  const branch = buildEditedBranchSession(
    sourceSession,
    0,
    "branch-1",
    "human-replacement",
    "新问题",
    "model-a"
  );
  expect(branch.threadId).toBe("branch-1");
  expect(branch.messages.map((message) => message.id)).toEqual(["human-replacement"]);
  expect(sourceSession.messages).toHaveLength(4);
});
```

- [ ] **Step 2: Run the workflow test and verify failure**

Run: `npm --prefix apps/desktop test -- editResend.spec.ts`

Expected: FAIL because `editResend.ts` does not exist.

- [ ] **Step 3: Implement focused workflow helpers**

Export these interfaces and functions:

```ts
export interface EditableTurn {
  userIndex: number;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  assistantMessageIds: string[];
  primaryAssistantMessageId: string;
}

export interface EditResendApi {
  createBranch: (threadId: string, body: ThreadBranchRequest) => Promise<ThreadBranchResponse>;
  prepareEdit: (threadId: string, humanMessageId: string, replacementText: string) => Promise<EditRegeneratePrepareResponse>;
  deleteThread: (threadId: string) => Promise<void>;
}

export function resolveEditableTurn(
  messages: ChatMessage[],
  userMessageId: string
): EditableTurn;

export function editableUserMessageIds(messages: ChatMessage[]): Set<string>;

export function selectEditModel(
  message: ChatMessage | undefined,
  availableModelNames: string[],
  fallbackModelName: string
): string;

export async function prepareEditedBranch(options: {
  sourceSession: ChatSession;
  userMessageId: string;
  replacementText: string;
  api: EditResendApi;
}): Promise<{
  target: EditableTurn;
  branch: ThreadBranchResponse;
  prepared: EditRegeneratePrepareResponse;
}>;

export function buildEditedBranchSession(
  source: ChatSession,
  userIndex: number,
  threadId: string,
  replacementHumanMessageId: string,
  replacementText: string,
  model: string
): ChatSession;
```

`prepareEditedBranch` must trim the replacement text, call branch with the complete ID list, call prepare on the returned thread, remove only `additional_kwargs.files`, and best-effort `deleteThread` if prepare fails. Cleanup failure must never replace the original prepare error.

`selectEditModel` returns `message.model` only when that model name is in `availableModelNames`; otherwise it returns `fallbackModelName`.

- [ ] **Step 4: Run workflow tests**

Run: `npm --prefix apps/desktop test -- editResend.spec.ts`

Expected: all workflow tests PASS.

- [ ] **Step 5: Commit the workflow module**

```bash
git add apps/desktop/src/lib/editResend.ts apps/desktop/tests/editResend.spec.ts
git commit -m "feat: add edit resend workflow"
```

### Task 4: Add Copy And Inline Editing To UserBubble

**Files:**
- Modify: `apps/desktop/src/components/UserBubble.tsx`
- Modify: `apps/desktop/src/styles.css`
- Create: `apps/desktop/tests/UserBubble.spec.tsx`

- [ ] **Step 1: Write failing component interaction tests**

Use React Testing Library to verify persistent icon actions, clipboard feedback, inline editing, cancel, validation, failure recovery, and disabled editing:

```tsx
it("常驻复制和编辑按钮，复制成功后切换反馈", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<UserBubble msg={userMessage} canEdit onEditResend={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "复制消息" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("原消息"));
  expect(screen.getByRole("button", { name: "已复制" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "编辑消息" })).toBeInTheDocument();
});

it("编辑后可取消或重新发送", async () => {
  const onEditResend = vi.fn().mockResolvedValue(undefined);
  render(<UserBubble msg={userMessage} canEdit onEditResend={onEditResend} />);
  fireEvent.click(screen.getByRole("button", { name: "编辑消息" }));
  fireEvent.change(screen.getByRole("textbox", { name: "编辑用户消息" }), {
    target: { value: "修改后的消息" }
  });
  fireEvent.click(screen.getByRole("button", { name: "重新发送" }));
  await waitFor(() => expect(onEditResend).toHaveBeenCalledWith("user-1", "修改后的消息"));
});

it("空文本禁用提交，提交失败保留编辑内容并显示错误", async () => {
  const onEditResend = vi.fn().mockRejectedValue(new Error("分支失败"));
  render(<UserBubble msg={userMessage} canEdit onEditResend={onEditResend} />);
  fireEvent.click(screen.getByRole("button", { name: "编辑消息" }));
  const textbox = screen.getByRole("textbox", { name: "编辑用户消息" });
  fireEvent.change(textbox, { target: { value: "   " } });
  expect(screen.getByRole("button", { name: "重新发送" })).toBeDisabled();
  fireEvent.change(textbox, { target: { value: "保留此文本" } });
  fireEvent.click(screen.getByRole("button", { name: "重新发送" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("分支失败");
  expect(textbox).toHaveValue("保留此文本");
});

it("复制失败不显示成功状态并提供错误反馈", async () => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("clipboard denied")) }
  });
  render(<UserBubble msg={userMessage} canEdit onEditResend={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "复制消息" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("复制失败");
  expect(screen.queryByRole("button", { name: "已复制" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run UserBubble tests and verify failure**

Run: `npm --prefix apps/desktop test -- UserBubble.spec.tsx`

Expected: FAIL because the actions and editor are absent.

- [ ] **Step 3: Implement the component state and accessible controls**

Use Lucide `Pencil`, `Copy`, and `Check`. Define this prop contract:

```ts
interface UserBubbleProps {
  msg: ChatMessage;
  canEdit?: boolean;
  editDisabled?: boolean;
  onEditResend?: (messageId: string, replacementText: string) => Promise<void>;
}
```

Keep `editing`, `editText`, `submitting`, `copied`, and `error` local. Await `navigator.clipboard.writeText`; show `Check` for 1.5 seconds. Await `onEditResend`; only close the editor on success. Render icon buttons as 28px square controls and keep the editor width constrained to the bubble column.

Add styles for `.user-message`, `.user-message-actions`, `.user-message-action`, `.user-message-editor`, `.user-message-editor textarea`, `.user-message-editor-footer`, and `.user-message-error`. Keep the existing green message bubble, use neutral gray action icons, and include `:hover`, `:focus-visible`, and disabled states.

- [ ] **Step 4: Run UserBubble tests**

Run: `npm --prefix apps/desktop test -- UserBubble.spec.tsx`

Expected: all UserBubble tests PASS.

- [ ] **Step 5: Commit the user bubble interaction**

```bash
git add apps/desktop/src/components/UserBubble.tsx apps/desktop/src/styles.css apps/desktop/tests/UserBubble.spec.tsx
git commit -m "feat: add user message actions"
```

### Task 5: Wire Editing Through ChatFeed

**Files:**
- Modify: `apps/desktop/src/components/ChatFeed.tsx`
- Create: `apps/desktop/tests/ChatFeed.spec.tsx`

- [ ] **Step 1: Write failing ChatFeed routing tests**

Mock `UserBubble` and verify that the editable ID set and callback reach only the intended user message:

```tsx
it("把可编辑状态和重发回调传给对应用户消息", () => {
  const onEditResend = vi.fn().mockResolvedValue(undefined);
  render(
    <ChatFeed
      messages={messages}
      editableUserMessageIds={new Set(["human-1"])}
      editDisabled={false}
      onEditResend={onEditResend}
    />
  );
  expect(screen.getByTestId("user-human-1")).toHaveAttribute("data-editable", "true");
  expect(screen.getByTestId("user-human-2")).toHaveAttribute("data-editable", "false");
});
```

- [ ] **Step 2: Run ChatFeed tests and verify failure**

Run: `npm --prefix apps/desktop test -- ChatFeed.spec.tsx`

Expected: FAIL because ChatFeed has no edit props.

- [ ] **Step 3: Add the narrow passthrough contract**

Extend `ChatFeedProps` with:

```ts
editableUserMessageIds?: ReadonlySet<string>;
editDisabled?: boolean;
onEditResend?: (messageId: string, replacementText: string) => Promise<void>;
```

For each user message, pass `canEdit={editableUserMessageIds?.has(m.id)}`, `editDisabled`, and `onEditResend` to `UserBubble`. Do not put branch lookup or API calls in `ChatFeed`.

- [ ] **Step 4: Run ChatFeed and UserBubble tests**

Run: `npm --prefix apps/desktop test -- ChatFeed.spec.tsx UserBubble.spec.tsx`

Expected: all component tests PASS.

- [ ] **Step 5: Commit feed wiring**

```bash
git add apps/desktop/src/components/ChatFeed.tsx apps/desktop/tests/ChatFeed.spec.tsx
git commit -m "feat: route user message edits through chat feed"
```

### Task 6: Integrate Branch Editing Into Home

**Files:**
- Modify: `apps/desktop/src/pages/Home.tsx`
- Modify: `apps/desktop/tests/editResend.spec.ts`
- Modify: `apps/desktop/tests/sessionStore.spec.ts`

- [ ] **Step 1: Add failing integration-level helper assertions**

Extend the workflow test to verify the original model is selected when available and current model is used as fallback:

```ts
expect(selectEditModel({ model: "model-a" }, ["model-a", "model-b"], "model-b")).toBe("model-a");
expect(selectEditModel({ model: "removed" }, ["model-a", "model-b"], "model-b")).toBe("model-b");
```

Extend `sessionStore.spec.ts` to ensure a user ID supplied to the regular send path survives JSON serialization.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm --prefix apps/desktop test -- editResend.spec.ts sessionStore.spec.ts`

Expected: FAIL until `selectEditModel` and the stable-ID path are complete.

- [ ] **Step 3: Refactor Home's stream execution into one shared function**

Inside `Home`, extract the existing Task 3/4 logic from `sendText` into an async `streamIntoSession` callback with this input:

```ts
interface StreamIntoSessionOptions {
  sessionId: string;
  threadId: string;
  model: ModelConfig;
  input: RunInput;
  checkpoint?: RunCheckpoint;
  metadata?: Record<string, unknown>;
}
```

The callback must append one `createAssistantTurn(model.name)`, set `streamingId`, create the abort controller, apply `reduceFrame`/`inferStage`, track `activeRunRef`, and clear all run refs in `finally`. Pass optional checkpoint and metadata to `streamRun`.

- [ ] **Step 4: Give regular sends one stable human ID**

Before appending a normal user message, generate one ID and use it in both places:

```ts
const humanMessageId = crypto.randomUUID();
appendMessageToSession(session, "user", text, modelName, humanMessageId);

const input: RunInput = {
  messages: [{
    role: "user",
    id: humanMessageId,
    content: text,
    ...(filesToSend ? { additional_kwargs: { files: filesToSend } } : {})
  }]
};
```

Then call `streamIntoSession` instead of duplicating the stream reducer block.

- [ ] **Step 5: Implement Home's edit-resend handler**

Import `createThreadBranch`, `prepareEditRegenerate`, `deleteThread`, and the `editResend` helpers. Implement an async handler with these guards and order:

```ts
const handleEditResend = async (messageId: string, replacementText: string) => {
  const source = activeSession;
  if (!source?.threadId || streamingId) throw new Error("当前任务暂时无法编辑重发");

  const modelName = selectEditModel(
    source.messages.find((message) => message.id === messageId),
    models.map((model) => model.name),
    activeModel
  );
  const model = models.find((candidate) => candidate.name === modelName);
  if (!model) throw new Error("没有可用模型，无法重新发送");

  const result = await prepareEditedBranch({
    sourceSession: source,
    userMessageId: messageId,
    replacementText,
    api: {
      createBranch: createThreadBranch,
      prepareEdit: prepareEditRegenerate,
      deleteThread
    }
  });

  const branchSession = buildEditedBranchSession(
    source,
    result.target.userIndex,
    result.branch.thread_id,
    result.prepared.replacement_human_message_id,
    replacementText.trim(),
    model.name
  );
  setSessions((current) => [branchSession, ...current]);
  setActiveSessionId(branchSession.id);
  await streamIntoSession({
    sessionId: branchSession.id,
    threadId: result.branch.thread_id,
    model,
    input: result.prepared.input,
    checkpoint: result.prepared.checkpoint,
    metadata: result.prepared.metadata
  });
};
```

Compute `editableUserMessageIds(activeSession.messages)` with `useMemo`. Pass the set, `editDisabled={Boolean(streamingId)}`, and `handleEditResend` through `WorkspaceShell` to `ChatFeed`.

- [ ] **Step 6: Run focused and complete frontend tests**

Run: `npm --prefix apps/desktop test -- editResend.spec.ts sessionStore.spec.ts turnsClient.spec.ts ChatFeed.spec.tsx UserBubble.spec.tsx`

Expected: focused tests PASS.

Run: `npm --prefix apps/desktop test`

Expected: complete desktop test suite PASS.

- [ ] **Step 7: Build the desktop frontend**

Run: `npm --prefix apps/desktop run build`

Expected: TypeScript and Vite build finish successfully with no errors.

- [ ] **Step 8: Commit Home integration**

```bash
git add apps/desktop/src/pages/Home.tsx apps/desktop/src/lib/editResend.ts apps/desktop/tests/editResend.spec.ts apps/desktop/tests/sessionStore.spec.ts
git commit -m "feat: edit and resend from conversation branches"
```

### Task 7: Visual And Interaction Verification

**Files:**
- Modify only if verification exposes a defect: `apps/desktop/src/components/UserBubble.tsx`
- Modify only if verification exposes a defect: `apps/desktop/src/styles.css`
- Test only if verification exposes a regression: `apps/desktop/tests/UserBubble.spec.tsx`

- [ ] **Step 1: Start the frontend dev server**

Run: `npm --prefix apps/desktop run dev -- --host 127.0.0.1 --port 1420`

Expected: Vite reports `http://127.0.0.1:1420/`. If 1420 is occupied, use 1421 and record that URL in the handoff.

- [ ] **Step 2: Verify desktop layout and interactions**

At `1440x900`, verify:

- Edit and copy buttons remain below every user bubble without shifting assistant content.
- Copy changes to the check icon and returns to copy.
- Edit expands in place, preserves line breaks, and keeps actions visible.
- Empty edited text disables resend.
- A failed resend keeps the editor text and shows its inline error.

- [ ] **Step 3: Verify narrow layout**

At `390x844`, verify the bubble, action row, textarea, cancel, and resend controls stay within the viewport and do not overlap adjacent messages.

- [ ] **Step 4: Run final automated verification**

Run: `npm --prefix apps/desktop test && npm --prefix apps/desktop run build`

Expected: all tests PASS and the production build succeeds.

- [ ] **Step 5: Commit any verification fixes**

If visual verification required changes:

```bash
git add apps/desktop/src/components/UserBubble.tsx apps/desktop/src/styles.css apps/desktop/tests/UserBubble.spec.tsx
git commit -m "fix: polish user message edit controls"
```

If no changes were required, do not create an empty commit.
