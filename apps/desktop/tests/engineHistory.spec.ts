import { describe, expect, it } from "vitest";
import { engineMessagesToChatMessages } from "../src/lib/engineHistory";

// ── engineMessagesToChatMessages ─────────────────────────────────────

describe("engineMessagesToChatMessages", () => {
  it("human 消息转成 user message（content 字符串）", () => {
    const msgs = [
      { type: "human", content: "你好", id: "h1", created_at: "2026-01-01T00:00:00Z" },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      role: "user",
      content: "你好",
      id: "h1",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("human content 为 content blocks 数组时拼接 text 块", () => {
    const msgs = [
      {
        type: "human",
        content: [
          { type: "text", text: "第一段" },
          { type: "text", text: "第二段" },
        ],
      },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out[0].content).toBe("第一段第二段");
  });

  it("ai 消息转成 assistant turn（text + status=done）", () => {
    const msgs = [
      { type: "human", content: "问" },
      { type: "ai", content: "答", id: "a1" },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({
      role: "assistant",
      text: "答",
      status: "done",
    });
  });

  it("ai 消息带 reasoning_content 时提取 reasoning 块", () => {
    const msgs = [
      {
        type: "ai",
        content: "答",
        additional_kwargs: { reasoning_content: "思考过程" },
      },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out[0].reasoning).toBeDefined();
    expect(out[0].reasoning?.text).toBe("思考过程");
    expect(out[0].reasoning?.endedAt).toBeDefined();
  });

  it("ai 消息带 tool_calls 时提取为 toolCalls 数组", () => {
    const msgs = [
      {
        type: "ai",
        content: "",
        tool_calls: [{ id: "tc1", name: "search", args: { q: "茅台" } }],
      },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out[0].toolCalls).toHaveLength(1);
    expect(out[0].toolCalls?.[0]).toMatchObject({
      id: "tc1",
      name: "search",
      args: { q: "茅台" },
      status: "done",
    });
  });

  it("tool_calls.args 为 JSON 字符串时自动解析", () => {
    const msgs = [
      {
        type: "ai",
        content: "",
        tool_calls: [{ id: "tc1", name: "search", args: '{"q":"茅台"}' }],
      },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out[0].toolCalls?.[0].args).toEqual({ q: "茅台" });
  });

  it("tool 消息回填到最近的 assistant turn 的 toolCalls（按 tool_call_id）", () => {
    const msgs = [
      { type: "human", content: "查茅台" },
      {
        type: "ai",
        content: "",
        tool_calls: [{ id: "tc1", name: "search", args: {} }],
      },
      { type: "tool", tool_call_id: "tc1", content: "搜索结果" },
      { type: "ai", content: "最终回答" },
    ];
    const out = engineMessagesToChatMessages(msgs);
    // human + ai(tc1) + ai(最终) = 3 条；tool 消息不单独产出
    expect(out).toHaveLength(3);
    expect(out[1].toolCalls?.[0].result).toBe("搜索结果");
    expect(out[1].toolCalls?.[0].status).toBe("done");
    expect(out[2].text).toBe("最终回答");
  });

  it("tool 消息的 tool_call_id 无匹配时静默忽略", () => {
    const msgs = [
      { type: "ai", content: "答", tool_calls: [{ id: "tc1", name: "x", args: {} }] },
      { type: "tool", tool_call_id: "不存在的id", content: "孤儿结果" },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out).toHaveLength(1);
    // toolCalls 的 result 保持 undefined（未回填）
    expect(out[0].toolCalls?.[0].result).toBeUndefined();
  });

  it("system 消息与 hide_from_ui 消息跳过", () => {
    const msgs = [
      { type: "system", content: "系统提示" },
      { type: "human", content: "可见问题" },
      { type: "ai", content: "隐藏回复", additional_kwargs: { hide_from_ui: true } },
      { type: "ai", content: "可见回复" },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out).toHaveLength(2);
    expect(out[0].content).toBe("可见问题");
    expect(out[1].text).toBe("可见回复");
  });

  it("qilin_error_fallback 的 ai 消息标记为 error", () => {
    const msgs = [
      {
        type: "ai",
        content: "provider 超时",
        additional_kwargs: { qilin_error_fallback: true },
      },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out[0].status).toBe("error");
    expect(out[0].error).toBe("provider 超时");
  });

  it("usage_metadata 提取为 TurnUsage", () => {
    const msgs = [
      {
        type: "ai",
        content: "答",
        usage_metadata: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out[0].usage).toEqual({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
    });
  });

  it("空 content 的 ai 消息（无 tool_calls/reasoning）忽略，不产出空气泡", () => {
    const msgs = [
      { type: "human", content: "问" },
      { type: "ai", content: "" },
      { type: "ai", content: "实际回复" },
    ];
    const out = engineMessagesToChatMessages(msgs);
    // 空 ai 忽略，只留 human + 实际回复
    expect(out).toHaveLength(2);
    expect(out[1].text).toBe("实际回复");
  });

  it("未知 type 消息宽容忽略", () => {
    const msgs = [
      { type: "human", content: "问" },
      { type: "unknown_type", content: "未知" },
      { type: "ai", content: "答" },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out).toHaveLength(2);
  });

  it("空数组返回空数组", () => {
    expect(engineMessagesToChatMessages([])).toEqual([]);
  });

  it("非对象元素宽容跳过", () => {
    const msgs = [
      null,
      "not an object",
      42,
      { type: "human", content: "有效" },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe("有效");
  });

  it("缺 id 时自动生成 UUID", () => {
    const msgs = [{ type: "human", content: "问" }];
    const out = engineMessagesToChatMessages(msgs);
    expect(out[0].id).toBeTruthy();
    expect(typeof out[0].id).toBe("string");
    expect(out[0].id.length).toBeGreaterThan(0);
  });

  it("完整对话序列：human → ai(tool_call) → tool → ai（最终回复）", () => {
    const msgs = [
      { type: "human", content: "分析茅台" },
      {
        type: "ai",
        content: "",
        tool_calls: [{ id: "tc1", name: "financial_query", args: { stock: "600519" } }],
      },
      { type: "tool", tool_call_id: "tc1", content: '{"revenue": 100}' },
      {
        type: "ai",
        content: "茅台 2024 年营收 100 亿。",
        usage_metadata: { input_tokens: 50, output_tokens: 30, total_tokens: 80 },
      },
    ];
    const out = engineMessagesToChatMessages(msgs);
    expect(out).toHaveLength(3);
    // 1. user
    expect(out[0].role).toBe("user");
    expect(out[0].content).toBe("分析茅台");
    // 2. assistant（工具调用 turn）
    expect(out[1].role).toBe("assistant");
    expect(out[1].toolCalls?.[0].name).toBe("financial_query");
    expect(out[1].toolCalls?.[0].result).toBe('{"revenue": 100}');
    // 3. assistant（最终回复 turn）
    expect(out[2].role).toBe("assistant");
    expect(out[2].text).toBe("茅台 2024 年营收 100 亿。");
    expect(out[2].usage?.total_tokens).toBe(80);
  });
});

// ── 事件行格式（引擎 GET /api/threads/{tid}/messages 真实返回） ────────

describe("engineMessagesToChatMessages - 事件行格式", () => {
  it("事件行：llm.human.input 内嵌 HumanMessage 转 user message", () => {
    const rows = [
      {
        event_type: "llm.human.input",
        category: "message",
        content: {
          type: "HumanMessage",
          content: "分析贵州茅台",
          id: "run-h1-xxx",
          additional_kwargs: {},
        },
        metadata: { caller: "api" },
        run_id: "r1",
        thread_id: "t1",
        seq: 1,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const out = engineMessagesToChatMessages(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      role: "user",
      content: "分析贵州茅台",
      id: "run-h1-xxx",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("事件行：llm.ai.response 内嵌 AIMessage 转 assistant turn", () => {
    const rows = [
      {
        event_type: "llm.human.input",
        category: "message",
        content: { type: "HumanMessage", content: "你好" },
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        event_type: "llm.ai.response",
        category: "message",
        content: {
          type: "AIMessage",
          content: "你好，我是 KStock",
          id: "run-a1-xxx",
          additional_kwargs: {},
          usage_metadata: { input_tokens: 10, output_tokens: 8, total_tokens: 18 },
        },
        metadata: { caller: "api", usage: {}, latency_ms: 500 },
        run_id: "r1",
        created_at: "2026-01-01T00:00:05Z",
      },
    ];
    const out = engineMessagesToChatMessages(rows);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({
      role: "assistant",
      text: "你好，我是 KStock",
      status: "done",
      createdAt: "2026-01-01T00:00:05Z",
    });
    expect(out[1].usage?.total_tokens).toBe(18);
  });

  it("事件行：ai 带 tool_calls + tool.result 回填结果", () => {
    const rows = [
      {
        event_type: "llm.human.input",
        category: "message",
        content: { type: "HumanMessage", content: "查茅台营收" },
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        event_type: "llm.ai.response",
        category: "message",
        content: {
          type: "AIMessage",
          content: "",
          tool_calls: [
            { id: "call_1", name: "financial_query", args: { stock: "600519" } },
          ],
          additional_kwargs: {},
        },
        run_id: "r1",
        created_at: "2026-01-01T00:00:05Z",
      },
      {
        event_type: "llm.tool.result",
        category: "message",
        content: {
          type: "ToolMessage",
          content: '{"revenue": 100}',
          tool_call_id: "call_1",
          name: "financial_query",
        },
        run_id: "r1",
        created_at: "2026-01-01T00:00:06Z",
      },
      {
        event_type: "llm.ai.response",
        category: "message",
        content: {
          type: "AIMessage",
          content: "茅台营收 100 亿",
          additional_kwargs: {},
        },
        run_id: "r1",
        created_at: "2026-01-01T00:00:10Z",
      },
    ];
    const out = engineMessagesToChatMessages(rows);
    // human + ai(工具调用) + ai(最终回复) = 3 条；tool.result 不单独产出
    expect(out).toHaveLength(3);
    expect(out[1].toolCalls?.[0].name).toBe("financial_query");
    expect(out[1].toolCalls?.[0].result).toBe('{"revenue": 100}');
    expect(out[1].toolCalls?.[0].status).toBe("done");
    expect(out[2].text).toBe("茅台营收 100 亿");
  });

  it("事件行：content 是 JSON string 时自动 parse", () => {
    const rows = [
      {
        event_type: "llm.ai.response",
        category: "message",
        // content 是 JSON string（未被 store 的 _row_to_dict 还原的情况）
        content: JSON.stringify({
          type: "AIMessage",
          content: "从 JSON string 还原",
          additional_kwargs: {},
        }),
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const out = engineMessagesToChatMessages(rows);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("从 JSON string 还原");
  });

  it("事件行：含 hide_from_ui 的 ai 消息跳过", () => {
    const rows = [
      {
        event_type: "llm.human.input",
        category: "message",
        content: { type: "HumanMessage", content: "可见问题" },
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        event_type: "llm.ai.response",
        category: "message",
        content: {
          type: "AIMessage",
          content: "隐藏回复",
          additional_kwargs: { hide_from_ui: true },
        },
        created_at: "2026-01-01T00:00:05Z",
      },
      {
        event_type: "llm.ai.response",
        category: "message",
        content: { type: "AIMessage", content: "可见回复", additional_kwargs: {} },
        created_at: "2026-01-01T00:00:10Z",
      },
    ];
    const out = engineMessagesToChatMessages(rows);
    expect(out).toHaveLength(2);
    expect(out[0].content).toBe("可见问题");
    expect(out[1].text).toBe("可见回复");
  });

  it("事件行：reasoning_content 提取为 reasoning 块", () => {
    const rows = [
      {
        event_type: "llm.ai.response",
        category: "message",
        content: {
          type: "AIMessage",
          content: "最终回答",
          additional_kwargs: { reasoning_content: "思考过程..." },
        },
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const out = engineMessagesToChatMessages(rows);
    expect(out[0].reasoning?.text).toBe("思考过程...");
    expect(out[0].reasoning?.endedAt).toBeDefined();
  });

  it("事件行：qilin_error_fallback 标记为 error", () => {
    const rows = [
      {
        event_type: "llm.ai.response",
        category: "message",
        content: {
          type: "AIMessage",
          content: "provider 超时",
          additional_kwargs: { qilin_error_fallback: true },
        },
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const out = engineMessagesToChatMessages(rows);
    expect(out[0].status).toBe("error");
    expect(out[0].error).toBe("provider 超时");
  });

  it("事件行：非 message category 的行宽容跳过", () => {
    const rows = [
      {
        event_type: "context:memory",
        category: "context",
        content: { text: "记忆上下文" },
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        event_type: "llm.human.input",
        category: "message",
        content: { type: "HumanMessage", content: "有效消息" },
        created_at: "2026-01-01T00:00:05Z",
      },
    ];
    const out = engineMessagesToChatMessages(rows);
    // context 行的 content 没有 type/tool_call_id，extractEmbeddedMessage 返回 { content: {...} }
    // 该 dict 无 type → 落到“未知类型”被忽略，只留 human
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe("有效消息");
  });
});
