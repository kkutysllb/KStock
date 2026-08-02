import { describe, expect, it } from "vitest";
import {
  appendMessageToSession,
  appendTurnToSession,
  bindThreadId,
  createAssistantTurn,
  createSession,
  threadToSession,
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

  it("threadToSession 从引擎 thread 恢复会话（绑定 threadId + 懒加载 messages）", () => {
    const session = threadToSession({
      thread_id: "thread-abc-123",
      created_at: "2026-07-31T00:00:00.000Z",
      updated_at: "2026-07-31T12:00:00.000Z",
      values: { title: "茅台财报分析" }
    });
    expect(session.threadId).toBe("thread-abc-123");
    expect(session.title).toBe("茅台财报分析");
    // 侧边栏需区分同一天内的会话：updatedAt 为 MM-DD HH:mm（含具体时间）
    expect(session.updatedAt).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    // 历史会话消息懒加载（切回后首次发消息或点进会话才拉取），初始为空
    expect(session.messages).toEqual([]);
    expect(session.activeSkills.length).toBeGreaterThan(0);
    expect(session.reportMarkdown).toBe("");
  });

  it("threadToSession 无 title 时回退占位文案", () => {
    const session = threadToSession({
      thread_id: "thread-def-456",
      values: {}
    });
    expect(session.title).toBe("历史任务");
    expect(session.threadId).toBe("thread-def-456");
  });

  it("threadToSession 超长 title 截断到 40 字符", () => {
    const longTitle = "超长标题".repeat(15); // 60 字符，超过 40 上限
    const session = threadToSession({
      thread_id: "thread-789",
      values: { title: longTitle }
    });
    expect(longTitle.length).toBe(60);
    expect(session.title.length).toBe(40);
  });
});
