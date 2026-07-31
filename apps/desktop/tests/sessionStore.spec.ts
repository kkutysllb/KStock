import { describe, expect, it } from "vitest";
import {
  appendMessageToSession,
  appendTurnToSession,
  bindThreadId,
  createAssistantTurn,
  createSession,
  createSeedSessions,
  updateMessageInSession,
  type ChatMessage
} from "../src/lib/sessionStore";

describe("sessionStore turn-based 模型", () => {
  it("createAssistantTurn 初始为 streaming 空正文", () => {
    const turn = createAssistantTurn("deepseek");
    expect(turn.role).toBe("assistant");
    expect(turn.status).toBe("streaming");
    expect(turn.text).toBe("");
    expect(turn.model).toBe("deepseek");
    expect(turn.reasoning).toBeUndefined();
    expect(turn.toolCalls).toBeUndefined();
  });

  it("appendMessageToSession 保持 user/assistant 兼容签名", () => {
    const session = createSession("测试");
    const s1 = appendMessageToSession(session, "user", "你好");
    expect(s1.messages).toHaveLength(1);
    expect(s1.messages[0].role).toBe("user");
    expect(s1.messages[0].content).toBe("你好");
    // 首条 user 消息更新标题
    expect(s1.title).toBe("你好");
  });

  it("appendTurnToSession 追加已构造的 assistant turn", () => {
    const session = createSession("测试");
    const turn = createAssistantTurn();
    const s1 = appendTurnToSession(session, turn);
    expect(s1.messages).toHaveLength(1);
    expect(s1.messages[0].id).toBe(turn.id);
    expect(s1.messages[0].status).toBe("streaming");
  });

  it("bindThreadId 绑定引擎 thread id", () => {
    const session = createSession("测试");
    expect(session.threadId).toBeUndefined();
    const s1 = bindThreadId(session, "thread-abc-123");
    expect(s1.threadId).toBe("thread-abc-123");
    // 不可变性：原 session 不变
    expect(session.threadId).toBeUndefined();
  });

  it("updateMessageInSession 局部更新指定 message", () => {
    const session = createSession("测试");
    const turn = createAssistantTurn();
    const s1 = appendTurnToSession(session, turn);
    const s2 = updateMessageInSession(s1, turn.id, { text: "流式正文", status: "done" });
    expect(s2.messages[0].text).toBe("流式正文");
    expect(s2.messages[0].status).toBe("done");
    // 其他字段保留
    expect(s2.messages[0].id).toBe(turn.id);
    expect(s2.messages[0].role).toBe("assistant");
  });

  it("turn-based 结构可 JSON 序列化往返（localStorage 持久化）", () => {
    const session = createSession("序列化测试");
    const turn: ChatMessage = {
      id: "turn-1",
      role: "assistant",
      createdAt: "2026-07-31T00:00:00.000Z",
      model: "deepseek",
      text: "分析结果",
      reasoning: { text: "我先想想…", startedAt: 1000, endedAt: 2500 },
      toolCalls: [
        { id: "tc-1", name: "get_financials", args: { code: "600519" }, status: "done", result: "..." }
      ],
      subagents: [
        { taskId: "task-1", description: "搜索新闻", status: "running", steps: [] }
      ],
      stage: "数据分析",
      status: "done",
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      thinkingMs: 1500
    };
    const withData = appendTurnToSession(
      appendMessageToSession(session, "user", "分析茅台", "deepseek"),
      turn
    );
    const roundTrip: typeof withData = JSON.parse(JSON.stringify(withData));
    expect(roundTrip.messages).toHaveLength(2);
    const restoredTurn = roundTrip.messages[1];
    expect(restoredTurn.text).toBe("分析结果");
    expect(restoredTurn.thinkingMs).toBe(1500);
    expect(restoredTurn.toolCalls?.[0].name).toBe("get_financials");
    expect(restoredTurn.subagents?.[0].taskId).toBe("task-1");
    expect(restoredTurn.usage?.total_tokens).toBe(150);
  });

  it("createSeedSessions 生成两个种子会话且无 threadId", () => {
    const sessions = createSeedSessions();
    expect(sessions).toHaveLength(2);
    for (const s of sessions) {
      expect(s.threadId).toBeUndefined();
      expect(s.messages).toEqual([]);
      expect(s.activeSkills.length).toBeGreaterThan(0);
    }
  });
});
