import { describe, expect, it, vi } from "vitest";
import {
  buildEditedBranchSession,
  editableUserMessageIds,
  prepareEditedBranch,
  resolveEditableTurn,
  selectEditModel
} from "../src/lib/editResend";
import { createSession, type ChatMessage, type ChatSession } from "../src/lib/sessionStore";
import type { EditRegeneratePrepareResponse, ThreadBranchResponse } from "../src/lib/turnsClient";

function message(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "message",
    role: "user",
    createdAt: "2026-08-05T00:00:00.000Z",
    content: "问题",
    ...overrides
  };
}

function sourceSession(): ChatSession {
  const session = createSession("分析任务");
  return {
    ...session,
    threadId: "thread-1",
    activeSkills: ["stock-analysis"],
    messages: [
      message({ id: "human-1", content: "原问题", model: "model-a" }),
      message({
        id: "assistant-1",
        role: "assistant",
        content: undefined,
        text: "旧回复",
        status: "done",
        engineMessageIds: ["ai-tool", "ai-final"]
      }),
      message({ id: "human-2", content: "后续问题", model: "model-a" }),
      message({
        id: "assistant-2",
        role: "assistant",
        content: undefined,
        text: "后续回复",
        status: "done",
        engineMessageIds: ["ai-2"]
      })
    ]
  };
}

const branchResponse: ThreadBranchResponse = {
  thread_id: "branch-1",
  parent_thread_id: "thread-1",
  parent_checkpoint_id: "checkpoint-1",
  branched_from_message_id: "ai-final",
  workspace_clone_mode: "skipped_historical_turn",
  history_seed_mode: "seeded"
};

const preparedResponse: EditRegeneratePrepareResponse = {
  input: {
    messages: [{
      type: "human",
      id: "human-replacement",
      content: [{ type: "text", text: "新问题" }],
      additional_kwargs: { referenced_message_contexts: [{ id: "ref-1" }] }
    }]
  },
  checkpoint: { checkpoint_ns: "", checkpoint_id: "checkpoint-base" },
  metadata: { replay_kind: "edit", regenerate_from_run_id: "run-old" },
  target_run_id: "run-old",
  replacement_human_message_id: "human-replacement",
  source_message_ids: ["human-1", "ai-tool", "ai-final"]
};

describe("resolveEditableTurn", () => {
  it("从用户消息定位紧邻的已完成 assistant turn", () => {
    const target = resolveEditableTurn(sourceSession().messages, "human-1");
    expect(target.userIndex).toBe(0);
    expect(target.assistantMessageIds).toEqual(["ai-tool", "ai-final"]);
    expect(target.primaryAssistantMessageId).toBe("ai-final");
  });

  it("assistant 未完成或缺少引擎 id 时不可编辑", () => {
    const streaming = sourceSession().messages.map((item) =>
      item.id === "assistant-1" ? { ...item, status: "streaming" as const } : item
    );
    expect(() => resolveEditableTurn(streaming, "human-1")).toThrow(/尚未完成/);

    const noEngineIds = sourceSession().messages.map((item) =>
      item.id === "assistant-1" ? { ...item, engineMessageIds: undefined } : item
    );
    expect(() => resolveEditableTurn(noEngineIds, "human-1")).toThrow(/消息标识/);
  });

  it("只返回有完成 assistant 回复的 user message", () => {
    expect(editableUserMessageIds(sourceSession().messages)).toEqual(new Set(["human-1", "human-2"]));
  });
});

describe("prepareEditedBranch", () => {
  it("先创建分支再准备编辑重跑，并移除历史附件", async () => {
    const calls: string[] = [];
    const preparedWithFiles = {
      ...preparedResponse,
      input: {
        ...preparedResponse.input,
        messages: [{
          ...preparedResponse.input.messages[0],
          additional_kwargs: {
            files: [{ filename: "old.pdf" }],
            referenced_message_contexts: [{ id: "ref-1" }]
          }
        }]
      }
    };
    const result = await prepareEditedBranch({
      sourceSession: sourceSession(),
      userMessageId: "human-1",
      replacementText: " 新问题 ",
      api: {
        createBranch: async (_threadId, body) => {
          calls.push(`branch:${body.message_id}`);
          return branchResponse;
        },
        prepareEdit: async (threadId, humanId, text) => {
          calls.push(`prepare:${threadId}:${humanId}:${text}`);
          return preparedWithFiles;
        },
        deleteThread: async () => {
          calls.push("delete");
        }
      }
    });
    expect(calls).toEqual(["branch:ai-final", "prepare:branch-1:human-1:新问题"]);
    expect(result.prepared.input.messages[0].additional_kwargs).toEqual({
      referenced_message_contexts: [{ id: "ref-1" }]
    });
  });

  it("prepare 失败时清理新建分支并保留原错误", async () => {
    const deleteThread = vi.fn().mockResolvedValue(undefined);
    const failure = new Error("prepare failed");
    await expect(prepareEditedBranch({
      sourceSession: sourceSession(),
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
});

describe("branch session helpers", () => {
  it("构造的新 session 截断原轮并使用后端生成的新 human id", () => {
    const source = sourceSession();
    const branch = buildEditedBranchSession(
      source,
      0,
      "branch-1",
      "human-replacement",
      "新问题",
      "model-a"
    );
    expect(branch.threadId).toBe("branch-1");
    expect(branch.messages.map((item) => item.id)).toEqual(["human-replacement"]);
    expect(branch.messages[0]).toMatchObject({ role: "user", content: "新问题", model: "model-a" });
    expect(branch.activeSkills).toEqual(["stock-analysis"]);
    expect(source.messages).toHaveLength(4);
  });

  it("编辑模型仍可用时沿用，否则回退当前模型", () => {
    expect(selectEditModel({ model: "model-a" }, ["model-a", "model-b"], "model-b")).toBe("model-a");
    expect(selectEditModel({ model: "removed" }, ["model-a", "model-b"], "model-b")).toBe("model-b");
  });
});
