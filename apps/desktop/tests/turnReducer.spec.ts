import { describe, expect, it } from "vitest";
import { initialTurn, reduceFrame, type AssistantTurnState } from "../src/lib/turnReducer";
import type { SseFrame } from "../src/lib/sseParser";

// ── 测试辅助 ──────────────────────────────────────────────────────────

function frame(event: string, data: unknown): SseFrame {
  return { event, data };
}

/** 构造 messages 事件的 data：[msg_dict, metadata_dict] */
function msg(message: Record<string, unknown>): unknown {
  return [message, { langgraph_node: "model" }];
}

function aiMsg(fields: Record<string, unknown>): unknown {
  return msg({ type: "ai", ...fields });
}

function toolMsg(fields: Record<string, unknown>): unknown {
  return msg({ type: "tool", ...fields });
}

// ── initialTurn ───────────────────────────────────────────────────────

describe("initialTurn", () => {
  it("初始为 streaming 空正文", () => {
    const s = initialTurn();
    expect(s.status).toBe("streaming");
    expect(s.text).toBe("");
    expect(s.reasoning).toBeUndefined();
    expect(s.toolCalls).toBeUndefined();
    expect(s.subagents).toBeUndefined();
  });
});

// ── 完整流式序列（集成） ─────────────────────────────────────────────

describe("完整流式序列集成：reasoning → tool_call → result → 正文 → end", () => {
  it("各阶段状态正确流转", () => {
    let s = initialTurn();
    const t0 = 1000;

    // reasoning 开始
    s = reduceFrame(s, frame("messages", aiMsg({ id: "m1", additional_kwargs: { reasoning_content: "我先想想" } })), t0);
    expect(s.reasoning?.text).toBe("我先想想");
    expect(s.reasoning?.startedAt).toBe(t0);
    expect(s.reasoning?.endedAt).toBeUndefined();

    // reasoning 续接
    s = reduceFrame(s, frame("messages", aiMsg({ id: "m1", additional_kwargs: { reasoning_content: "…" } })), t0 + 100);
    expect(s.reasoning?.text).toBe("我先想想…");

    // tool_call 请求 → reasoning 结束
    s = reduceFrame(s, frame("messages", aiMsg({ id: "m1", tool_calls: [{ id: "tc1", name: "get_financials", args: { code: "600519" } }] })), t0 + 500);
    expect(s.reasoning?.endedAt).toBe(t0 + 500);
    expect(s.toolCalls?.[0]).toMatchObject({ id: "tc1", name: "get_financials", status: "running" });
    expect(s.toolCalls?.[0].args).toEqual({ code: "600519" });
    expect(s.toolCalls?.[0].startedAt).toBe(t0 + 500);

    // tool 结果回填
    s = reduceFrame(s, frame("messages", toolMsg({ tool_call_id: "tc1", content: '{"revenue":100}' })), t0 + 800);
    expect(s.toolCalls?.[0].status).toBe("done");
    expect(s.toolCalls?.[0].result).toBe('{"revenue":100}');
    expect(s.toolCalls?.[0].endedAt).toBe(t0 + 800);

    // 正文增量
    s = reduceFrame(s, frame("messages", aiMsg({ id: "m1", content: "茅台" })), t0 + 900);
    s = reduceFrame(s, frame("messages", aiMsg({ id: "m1", content: "营收" })), t0 + 910);
    expect(s.text).toBe("茅台营收");

    // end 收尾
    s = reduceFrame(s, frame("end", { usage: { input: 100, output: 50, total: 150 } }), t0 + 1000);
    expect(s.status).toBe("done");
    expect(s.thinkingMs).toBe(500); // endedAt(1500) - startedAt(1000)
    expect(s.usage?.total_tokens).toBe(150);
  });
});

// ── messages 事件分支 ────────────────────────────────────────────────

describe("messages 事件", () => {
  it("ai content 多帧增量累加", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", aiMsg({ content: "Hello" })), 1);
    s = reduceFrame(s, frame("messages", aiMsg({ content: " " })), 2);
    s = reduceFrame(s, frame("messages", aiMsg({ content: "World" })), 3);
    expect(s.text).toBe("Hello World");
  });

  it("ai content 空字符串被忽略（values 快照补发的空 content）", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", aiMsg({ content: "保留" })), 1);
    s = reduceFrame(s, frame("messages", aiMsg({ content: "" })), 2);
    expect(s.text).toBe("保留");
  });

  it("ai content 非字符串（数组 content）不累加", () => {
    const s = reduceFrame(initialTurn(), frame("messages", aiMsg({ content: [{ type: "text", text: "x" }] })), 1);
    expect(s.text).toBe("");
  });

  it("reasoning_content 流式累加 + 首次建 startedAt", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", aiMsg({ additional_kwargs: { reasoning_content: "第一步" } })), 100);
    s = reduceFrame(s, frame("messages", aiMsg({ additional_kwargs: { reasoning_content: "第二步" } })), 200);
    expect(s.reasoning?.text).toBe("第一步第二步");
    expect(s.reasoning?.startedAt).toBe(100);
    expect(s.reasoning?.endedAt).toBeUndefined();
  });

  it("reasoning 兼容 additional_kwargs.reasoning（其他 provider）", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("messages", aiMsg({ additional_kwargs: { reasoning: "另一种思考流" } })),
      100
    );
    expect(s.reasoning?.text).toBe("另一种思考流");
  });

  it("tool_calls 按 id 合并、status=running", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "search", args: { q: "茅台" } }] })), 1);
    s = reduceFrame(s, frame("messages", aiMsg({ tool_calls: [{ id: "tc2", name: "get_price", args: { code: "600519" } }] })), 2);
    expect(s.toolCalls).toHaveLength(2);
    expect(s.toolCalls?.[0]).toMatchObject({ id: "tc1", name: "search", status: "running" });
    expect(s.toolCalls?.[1]).toMatchObject({ id: "tc2", name: "get_price", status: "running" });
  });

  it("tool_calls 同 id 多帧合并 args", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "f", args: { a: 1 } }] })), 1);
    s = reduceFrame(s, frame("messages", aiMsg({ tool_calls: [{ id: "tc1", args: { b: 2 } }] })), 2);
    expect(s.toolCalls).toHaveLength(1);
    expect(s.toolCalls?.[0].args).toEqual({ a: 1, b: 2 });
  });

  it("tool_calls args 为 JSON 字符串时自动 parse", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "f", args: '{"x":42}' }] })),
      1
    );
    expect(s.toolCalls?.[0].args).toEqual({ x: 42 });
  });

  it("tool_calls args 非法 JSON 时退化为空对象", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "f", args: "not-json" }] })),
      1
    );
    expect(s.toolCalls?.[0].args).toEqual({});
  });

  it("首个 tool_call 时刻 = reasoning 结束", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", aiMsg({ additional_kwargs: { reasoning_content: "思考" } })), 100);
    expect(s.reasoning?.endedAt).toBeUndefined();
    s = reduceFrame(s, frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "f", args: {} }] })), 300);
    expect(s.reasoning?.endedAt).toBe(300);
  });

  it("无 reasoning 时 tool_call 不触发 endedAt", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "f", args: {} }] })),
      300
    );
    expect(s.reasoning).toBeUndefined();
  });

  it("tool message 回填 result + status=done", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "f", args: {} }] })), 1);
    s = reduceFrame(s, frame("messages", toolMsg({ tool_call_id: "tc1", content: "结果文本" })), 2);
    expect(s.toolCalls?.[0].status).toBe("done");
    expect(s.toolCalls?.[0].result).toBe("结果文本");
  });

  it("tool message content 为对象时 JSON 序列化", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "f", args: {} }] })), 1);
    s = reduceFrame(s, frame("messages", toolMsg({ tool_call_id: "tc1", content: { data: 1 } })), 2);
    expect(s.toolCalls?.[0].result).toBe('{"data":1}');
  });

  it("tool message 带 artifact 时回填", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "f", args: {} }] })), 1);
    const art = { path: "/outputs/report.md" };
    s = reduceFrame(s, frame("messages", toolMsg({ tool_call_id: "tc1", content: "ok", artifact: art })), 2);
    expect(s.toolCalls?.[0].artifact).toEqual(art);
  });

  it("render_html_report 工具结果同步写入 artifacts，报告入口不依赖后续 values 快照", () => {
    let s = initialTurn();
    s = reduceFrame(
      s,
      frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "render_html_report", args: {} }] })),
      1
    );
    s = reduceFrame(
      s,
      frame("messages", toolMsg({
        name: "render_html_report",
        tool_call_id: "tc1",
        content: JSON.stringify({ thread_virtual_path: "/outputs/report.html" }),
      })),
      2
    );
    expect(s.artifacts).toEqual(["/outputs/report.html"]);
  });

  it("render_html_report_from_file 工具结果缺少路径时仍回填默认报告入口", () => {
    let s = initialTurn();
    s = reduceFrame(
      s,
      frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "render_html_report_from_file", args: {} }] })),
      1
    );
    s = reduceFrame(
      s,
      frame("messages", toolMsg({
        name: "render_html_report_from_file",
        tool_call_id: "tc1",
        content: JSON.stringify({ report_id: "report-1" }),
      })),
      2
    );
    expect(s.artifacts).toEqual(["/outputs/report.html"]);
  });

  it("tool message 无匹配 tool_call_id 时忽略", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "f", args: {} }] })), 1);
    s = reduceFrame(s, frame("messages", toolMsg({ tool_call_id: "unknown", content: "x" })), 2);
    expect(s.toolCalls?.[0].status).toBe("running"); // 不变
  });

  it("hide_from_ui=true 的 ai message 被跳过", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("messages", aiMsg({ content: "system reminder", additional_kwargs: { hide_from_ui: true } })),
      1
    );
    expect(s.text).toBe("");
  });

  it("usage_metadata 提取用量", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("messages", aiMsg({ usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } })),
      1
    );
    expect(s.usage).toEqual({ input_tokens: 10, output_tokens: 5, total_tokens: 15 });
  });

  it("data 非数组时防御性忽略", () => {
    const s = reduceFrame(initialTurn(), frame("messages", { type: "ai", content: "x" }), 1);
    expect(s.text).toBe("");
  });

  it("data 空数组时防御性忽略", () => {
    const s = reduceFrame(initialTurn(), frame("messages", []), 1);
    expect(s.text).toBe("");
  });

  it("human/system 类型消息被忽略", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", msg({ type: "human", content: "用户输入" })), 1);
    s = reduceFrame(s, frame("messages", msg({ type: "system", content: "系统消息" })), 2);
    expect(s.text).toBe("");
  });

  // 流式 chunk（langchain_openai ChatOpenAI 系）：type 是 "AIMessageChunk"
  it("AIMessageChunk 流式 chunk 的 content 增量累加", () => {
    let s = initialTurn();
    s = reduceFrame(
      s,
      frame(
        "messages",
        msg({
          type: "AIMessageChunk",
          content: "收到",
          id: "lc_run--chunk-1",
          additional_kwargs: {},
        })
      ),
      1
    );
    s = reduceFrame(
      s,
      frame(
        "messages",
        msg({
          type: "AIMessageChunk",
          content: "消息！",
          id: "lc_run--chunk-1",
          additional_kwargs: {},
        })
      ),
      2
    );
    expect(s.text).toBe("收到消息！");
  });

  it("AIMessageChunk 的 reasoning_content 同样触发 reasoning 流", () => {
    let s = initialTurn();
    s = reduceFrame(
      s,
      frame(
        "messages",
        msg({
          type: "AIMessageChunk",
          content: "",
          additional_kwargs: { reasoning_content: "思考中" },
        })
      ),
      100
    );
    expect(s.reasoning?.text).toBe("思考中");
    expect(s.reasoning?.startedAt).toBe(100);
  });

  it("AIMessageChunk 与 ai 混合序列累加正确", () => {
    // 模拟真实场景：流式 chunk 后接 values 快照的最终 ai message
    let s = initialTurn();
    s = reduceFrame(
      s,
      frame("messages", msg({ type: "AIMessageChunk", content: "流式", id: "m1" })),
      1
    );
    s = reduceFrame(
      s,
      frame("messages", msg({ type: "AIMessageChunk", content: "增量", id: "m1" })),
      2
    );
    s = reduceFrame(
      s,
      frame("messages", msg({ type: "ai", content: "", id: "m1" })),
      3
    );
    expect(s.text).toBe("流式增量");
  });
});

// ── 语义路由（跨 provider 通用适配） ────────────────────────────────
describe("语义路由：不依赖 type 字符串", () => {
  it("tool message 缺 type 字段但有 tool_call_id → 路由到 tool 回填", () => {
    // 先发 tool_call 请求，再发无 type 的 tool 结果
    let s = initialTurn();
    s = reduceFrame(
      s,
      frame("messages", msg({ type: "ai", tool_calls: [{ id: "tc1", name: "f", args: {} }] })),
      1
    );
    s = reduceFrame(
      s,
      frame("messages", msg({ tool_call_id: "tc1", content: "结果" })),
      2
    );
    expect(s.toolCalls?.[0].status).toBe("done");
    expect(s.toolCalls?.[0].result).toBe("结果");
  });

  it("ai message 缺 type 字段但有 content → 路由到 ai 正文累加", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("messages", msg({ content: "无 type 的 AI 文本" })),
      1
    );
    expect(s.text).toBe("无 type 的 AI 文本");
  });

  it("human message 有 content 但 type=human → 跳过不误判为 ai", () => {
    // 引擎 input echo：human message 可能携带 content
    const s = reduceFrame(
      initialTurn(),
      frame("messages", msg({ type: "human", content: "用户输入" })),
      1
    );
    expect(s.text).toBe("");
  });

  it("HumanMessageChunk（流式回显）也跳过", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("messages", msg({ type: "HumanMessageChunk", content: "x" })),
      1
    );
    expect(s.text).toBe("");
  });

  it("SystemMessageChunk 跳过", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("messages", msg({ type: "SystemMessageChunk", content: "sys" })),
      1
    );
    expect(s.text).toBe("");
  });

  it("未知 type 但有 AI 信号（reasoning_content）→ 路由到 ai", () => {
    // 模拟未来新增 provider：非标准 type 名，但字段语义一致
    const s = reduceFrame(
      initialTurn(),
      frame(
        "messages",
        msg({ type: "FutureProviderMsg", additional_kwargs: { reasoning_content: "未来思考" } })
      ),
      100
    );
    expect(s.reasoning?.text).toBe("未来思考");
  });

  it("未知 type 且有 tool_calls → 路由到 ai（tool_call 请求分支）", () => {
    const s = reduceFrame(
      initialTurn(),
      frame(
        "messages",
        msg({ type: "CustomAI", tool_calls: [{ id: "tc1", name: "search", args: { q: "a" } }] })
      ),
      1
    );
    expect(s.toolCalls?.[0].name).toBe("search");
    expect(s.toolCalls?.[0].status).toBe("running");
  });

  it("空 content + 无任何 AI 信号的帧 → 不产生副作用", () => {
    // 流式初始帧：content="" 且无其他字段，仅有 type 和 id
    // 走 type 兖底路由到 ai，但空 content / 无 reasoning / 无 tool_calls → 状态不变
    const initial = initialTurn();
    const s = reduceFrame(
      initial,
      frame("messages", msg({ type: "AIMessageChunk", content: "", id: "m1" })),
      1
    );
    expect(s.text).toBe("");
    expect(s.reasoning).toBeUndefined();
    expect(s.toolCalls).toBeUndefined();
    expect(s.usage).toBeUndefined();
  });

  it("usage_metadata 单独出现（finish chunk）→ 路由到 ai 填用量", () => {
    const s = reduceFrame(
      initialTurn(),
      frame(
        "messages",
        msg({
          type: "AIMessageChunk",
          content: "",
          usage_metadata: { input_tokens: 100, output_tokens: 20, total_tokens: 120 }
        })
      ),
      1
    );
    expect(s.usage?.total_tokens).toBe(120);
  });
});

// ── custom 事件（task 分组） ─────────────────────────────────────────

describe("custom 事件：task 分组", () => {
  it("task_started 创建 subagent", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("custom", { type: "task_started", task_id: "t1", description: "搜索新闻", model_name: "deepseek" }),
      1
    );
    expect(s.subagents).toHaveLength(1);
    expect(s.subagents?.[0]).toMatchObject({
      taskId: "t1", description: "搜索新闻", model: "deepseek", status: "running", steps: []
    });
  });

  it("task_started 同 task_id 去重（重放）", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("custom", { type: "task_started", task_id: "t1" }), 1);
    s = reduceFrame(s, frame("custom", { type: "task_started", task_id: "t1" }), 2);
    expect(s.subagents).toHaveLength(1);
  });

  it("task_running 追加 step（含 text）", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("custom", { type: "task_started", task_id: "t1" }), 1);
    s = reduceFrame(
      s,
      frame("custom", {
        type: "task_running", task_id: "t1",
        message: { type: "ai", content: "子代理第一条消息" },
        message_index: 1, total_messages: 2
      }),
      2
    );
    expect(s.subagents?.[0].steps).toHaveLength(1);
    expect(s.subagents?.[0].steps[0]).toMatchObject({ index: 1, text: "子代理第一条消息" });
  });

  it("task_running step 含 toolCalls", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("custom", { type: "task_started", task_id: "t1" }), 1);
    s = reduceFrame(
      s,
      frame("custom", {
        type: "task_running", task_id: "t1",
        message: { type: "ai", content: "调用工具", tool_calls: [{ id: "sc1", name: "sub_tool", args: {} }] },
        message_index: 1
      }),
      2
    );
    expect(s.subagents?.[0].steps[0].toolCalls?.[0]).toMatchObject({ id: "sc1", name: "sub_tool" });
  });

  it("task_running 按 message_index 去重更新（重放）", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("custom", { type: "task_started", task_id: "t1" }), 1);
    s = reduceFrame(s, frame("custom", { type: "task_running", task_id: "t1", message: { content: "v1" }, message_index: 1 }), 2);
    s = reduceFrame(s, frame("custom", { type: "task_running", task_id: "t1", message: { content: "v1-updated" }, message_index: 1 }), 3);
    s = reduceFrame(s, frame("custom", { type: "task_running", task_id: "t1", message: { content: "v2" }, message_index: 2 }), 4);
    expect(s.subagents?.[0].steps).toHaveLength(2);
    expect(s.subagents?.[0].steps[0].text).toBe("v1-updated");
    expect(s.subagents?.[0].steps[1].text).toBe("v2");
  });

  it("task_running 无 task_started 前置时忽略", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("custom", { type: "task_running", task_id: "unknown", message: { content: "x" }, message_index: 1 }),
      1
    );
    expect(s.subagents).toBeUndefined();
  });

  it("task_completed/failed/cancelled/timed_out 更新 status", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("custom", { type: "task_started", task_id: "t1" }), 1);
    s = reduceFrame(s, frame("custom", { type: "task_completed", task_id: "t1", result: "done" }), 2);
    expect(s.subagents?.[0].status).toBe("completed");

    let s2 = initialTurn();
    s2 = reduceFrame(s2, frame("custom", { type: "task_started", task_id: "t2" }), 1);
    s2 = reduceFrame(s2, frame("custom", { type: "task_failed", task_id: "t2", error: "boom" }), 2);
    expect(s2.subagents?.[0].status).toBe("failed");

    let s3 = initialTurn();
    s3 = reduceFrame(s3, frame("custom", { type: "task_started", task_id: "t3" }), 1);
    s3 = reduceFrame(s3, frame("custom", { type: "task_cancelled", task_id: "t3" }), 2);
    expect(s3.subagents?.[0].status).toBe("cancelled");

    let s4 = initialTurn();
    s4 = reduceFrame(s4, frame("custom", { type: "task_started", task_id: "t4" }), 1);
    s4 = reduceFrame(s4, frame("custom", { type: "task_timed_out", task_id: "t4" }), 2);
    expect(s4.subagents?.[0].status).toBe("timed_out");
  });

  it("并行多个 task 分组", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("custom", { type: "task_started", task_id: "t1", description: "搜索" }), 1);
    s = reduceFrame(s, frame("custom", { type: "task_started", task_id: "t2", description: "分析" }), 2);
    s = reduceFrame(s, frame("custom", { type: "task_running", task_id: "t1", message: { content: "搜索中" }, message_index: 1 }), 3);
    s = reduceFrame(s, frame("custom", { type: "task_running", task_id: "t2", message: { content: "分析中" }, message_index: 1 }), 4);
    expect(s.subagents).toHaveLength(2);
    expect(s.subagents?.[0].taskId).toBe("t1");
    expect(s.subagents?.[0].steps[0].text).toBe("搜索中");
    expect(s.subagents?.[1].taskId).toBe("t2");
    expect(s.subagents?.[1].steps[0].text).toBe("分析中");
  });

  it("未知 custom type 忽略（guardrail/skill_activation 等）", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("custom", { type: "middleware:guardrail", decision: "pass" }),
      1
    );
    expect(s.subagents).toBeUndefined();
    expect(s.status).toBe("streaming");
  });

  it("task_running 携带 ToolMessage → 回填 step 工具调用为 done", () => {
    // 回归：引擎对 subagent 工具结果发 ToolMessage（带 tool_call_id），
    // 之前被忽略导致残留 running；现在按 tool_call_id 回填结果。
    let s = initialTurn();
    s = reduceFrame(s, frame("custom", { type: "task_started", task_id: "t1" }), 1);
    s = reduceFrame(
      s,
      frame("custom", {
        type: "task_running", task_id: "t1",
        message: { type: "ai", content: "调用工具", tool_calls: [{ id: "sc1", name: "sub_tool", args: {} }] },
        message_index: 1
      }),
      2
    );
    expect(s.subagents?.[0].steps[0].toolCalls?.[0].status).toBe("running");

    s = reduceFrame(
      s,
      frame("custom", {
        type: "task_running", task_id: "t1",
        message: { type: "tool", tool_call_id: "sc1", content: '{"ok":true}' },
        message_index: 1
      }),
      3
    );
    expect(s.subagents?.[0].steps[0].toolCalls?.[0]).toMatchObject({
      id: "sc1", status: "done", result: '{"ok":true}', endedAt: 3
    });
  });

  it("end 收尾 subagents 步骤残留的 running 工具调用", () => {
    // 回归：turn 收到 end 后顶层 toolCalls 被收尾，但 subagent 步骤内的
    // 工具调用仍残留 running；现在一并收尾为 done。
    let s = initialTurn();
    s = reduceFrame(s, frame("custom", { type: "task_started", task_id: "t1" }), 1);
    s = reduceFrame(
      s,
      frame("custom", {
        type: "task_running", task_id: "t1",
        message: { type: "ai", content: "调用工具", tool_calls: [{ id: "sc1", name: "sub_tool", args: {} }] },
        message_index: 1
      }),
      2
    );
    s = reduceFrame(s, frame("end", {}), 100);
    expect(s.status).toBe("done");
    expect(s.subagents?.[0].steps[0].toolCalls?.[0]).toMatchObject({ status: "done", endedAt: 100 });
  });

  it("tool 结果回填后，同 id tool_call 帧重发不重置为 running", () => {
    // 顶层：tool message 回填 done 后，ai 帧重发同 id 不得重置状态
    let s = initialTurn();
    s = reduceFrame(s, frame("messages", aiMsg({ id: "m1", tool_calls: [{ id: "tc1", name: "search", args: { q: "a" } }] })), 1);
    s = reduceFrame(s, frame("messages", toolMsg({ tool_call_id: "tc1", content: "ok" })), 2);
    expect(s.toolCalls?.[0].status).toBe("done");
    s = reduceFrame(s, frame("messages", aiMsg({ id: "m1", tool_calls: [{ id: "tc1", name: "search", args: { q: "b" } }] })), 3);
    expect(s.toolCalls?.[0].status).toBe("done");

    // subagent 步骤同理：同 step 重放 ai 帧不得覆盖已回填的 done
    let s2 = initialTurn();
    s2 = reduceFrame(s2, frame("custom", { type: "task_started", task_id: "t1" }), 1);
    s2 = reduceFrame(
      s2,
      frame("custom", {
        type: "task_running", task_id: "t1",
        message: { type: "ai", content: "调用工具", tool_calls: [{ id: "sc1", name: "sub_tool", args: {} }] },
        message_index: 1
      }),
      2
    );
    s2 = reduceFrame(
      s2,
      frame("custom", {
        type: "task_running", task_id: "t1",
        message: { type: "tool", tool_call_id: "sc1", content: "ok" },
        message_index: 1
      }),
      3
    );
    s2 = reduceFrame(
      s2,
      frame("custom", {
        type: "task_running", task_id: "t1",
        message: { type: "ai", content: "调用工具", tool_calls: [{ id: "sc1", name: "sub_tool", args: {} }] },
        message_index: 1
      }),
      4
    );
    expect(s2.subagents?.[0].steps[0].toolCalls?.[0].status).toBe("done");
  });
});

// ── values 快照 ──────────────────────────────────────────────────────

describe("values 快照", () => {
  it("更新 threadTitle", () => {
    const s = reduceFrame(initialTurn(), frame("values", { title: "茅台分析" }), 1);
    expect(s.threadTitle).toBe("茅台分析");
  });

  it("空 title 不更新", () => {
    const s = reduceFrame(initialTurn(), frame("values", { title: "" }), 1);
    expect(s.threadTitle).toBeUndefined();
  });

  it("更新 artifacts", () => {
    const arts = [{ path: "/outputs/r.md" }];
    const s = reduceFrame(initialTurn(), frame("values", { artifacts: arts }), 1);
    expect(s.artifacts).toEqual(arts);
  });

  it("skill_context 解析为任务实际技能名列表", () => {
    const s = reduceFrame(
      initialTurn(),
      frame("values", {
        skill_context: [
          { name: "news-search", path: "/mnt/skills/public/news-search/SKILL.md" },
          { name: "market-linkage-engine", path: "/mnt/skills/public/market-linkage-engine/SKILL.md" },
          { name: "", path: "/mnt/skills/public/common/SKILL.md" } // 空 name 应过滤
        ]
      }),
      1
    );
    expect(s.skills).toEqual(["news-search", "market-linkage-engine"]);
  });

  it("skill_context 非数组时不覆盖", () => {
    const s = reduceFrame(initialTurn(), frame("values", { skill_context: "nope" }), 1);
    expect(s.skills).toBeUndefined();
  });

  it("compaction 检测：messages 数量收缩时标 compacted", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("values", { messages: [1, 2, 3, 4, 5] }), 1);
    expect(s.status).toBe("streaming");
    expect(s.seenMsgCount).toBe(5);
    s = reduceFrame(s, frame("values", { messages: [1, 2] }), 2); // 5 → 2 收缩
    expect(s.status).toBe("compacted");
  });

  it("非收缩时不变 compacted", () => {
    let s = initialTurn();
    s = reduceFrame(s, frame("values", { messages: [1, 2] }), 1);
    s = reduceFrame(s, frame("values", { messages: [1, 2, 3] }), 2); // 2 → 3 增长
    expect(s.status).toBe("streaming");
  });

  it("首次 values 不误报 compaction（prev=0）", () => {
    const s = reduceFrame(initialTurn(), frame("values", { messages: [1] }), 1);
    expect(s.status).toBe("streaming");
  });
});

// ── end / error ──────────────────────────────────────────────────────

describe("end 事件", () => {
  it("status=done", () => {
    const s = reduceFrame(initialTurn(), frame("end", null), 1);
    expect(s.status).toBe("done");
  });

  it("收尾 reasoning：填 endedAt + thinkingMs", () => {
    let s: AssistantTurnState = { text: "", status: "streaming", reasoning: { text: "思考", startedAt: 1000 } };
    s = reduceFrame(s, frame("end", null), 2500);
    expect(s.reasoning?.endedAt).toBe(2500);
    expect(s.thinkingMs).toBe(1500);
  });

  it("无 reasoning 时 end 不报错", () => {
    const s = reduceFrame(initialTurn(), frame("end", null), 1);
    expect(s.reasoning).toBeUndefined();
    expect(s.thinkingMs).toBeUndefined();
  });

  it("补 usage（data 含 usage）", () => {
    const s = reduceFrame(initialTurn(), frame("end", { usage: { input: 10, output: 20, total: 30 } }), 1);
    expect(s.usage).toEqual({ input_tokens: 10, output_tokens: 20, total_tokens: 30 });
  });

  it("end 收尾仍在 running 的工具调用，避免完成后摘要继续显示处理中", () => {
    let s = reduceFrame(
      initialTurn(),
      frame("messages", aiMsg({ tool_calls: [{ id: "tc1", name: "bash", args: { cmd: "run" } }] })),
      1000
    );

    s = reduceFrame(s, frame("end", null), 2500);

    expect(s.status).toBe("done");
    expect(s.toolCalls?.[0]).toMatchObject({
      id: "tc1",
      status: "done",
      startedAt: 1000,
      endedAt: 2500,
    });
  });

  it("已有 usage 时不覆盖", () => {
    let s: AssistantTurnState = { text: "", status: "streaming", usage: { input_tokens: 100, output_tokens: 0, total_tokens: 100 } };
    s = reduceFrame(s, frame("end", { usage: { input: 1, output: 1, total: 2 } }), 1);
    expect(s.usage?.total_tokens).toBe(100);
  });

  it("compacted 状态不被 end 覆盖", () => {
    let s: AssistantTurnState = { text: "", status: "compacted" };
    s = reduceFrame(s, frame("end", null), 1);
    expect(s.status).toBe("compacted");
  });
});

describe("error / gap 事件", () => {
  it("error status=error + 默认消息", () => {
    const s = reduceFrame(initialTurn(), frame("error", { detail: "some error" }), 1);
    expect(s.status).toBe("error");
    expect(s.error).toBe("引擎 run 报错");
  });

  it("error data 为字符串时用字符串", () => {
    const s = reduceFrame(initialTurn(), frame("error", "模型超时"), 1);
    expect(s.error).toBe("模型超时");
  });

  it("gap status=error + gap 消息", () => {
    const s = reduceFrame(initialTurn(), frame("gap", { code: "stream_replay_gap" }), 1);
    expect(s.status).toBe("error");
    expect(s.error).toMatch(/stream replay gap/);
  });
});

// ── 无关帧 ───────────────────────────────────────────────────────────

describe("无关帧", () => {
  it("metadata 等未知 event 原样返回 state", () => {
    const before = initialTurn();
    const after = reduceFrame(before, frame("metadata", { run_id: "r1" }), 1);
    expect(after).toBe(before); // 引用相等（未变）
  });
});

// ── qilin_error_fallback（引擎把 provider error 包装成 ai message） ──

describe("qilin_error_fallback", () => {
  it("带 qilin_error_fallback 的 ai message 标记为 error 而非正文", () => {
    const s = reduceFrame(
      initialTurn(),
      frame(
        "messages",
        aiMsg({
          id: "m1",
          content: "The configured LLM provider rejected the request.",
          additional_kwargs: {
            qilin_error_fallback: true,
            error_type: "AuthenticationError",
            error_reason: "auth",
          },
        })
      ),
      1000
    );
    expect(s.status).toBe("error");
    expect(s.error).toBe("The configured LLM provider rejected the request.");
    expect(s.text).toBe(""); // 不作为正文累积
  });

  it("qilin_error_fallback 空 content 时用兜底文案", () => {
    const s = reduceFrame(
      initialTurn(),
      frame(
        "messages",
        aiMsg({
          id: "m2",
          content: "",
          additional_kwargs: { qilin_error_fallback: true },
        })
      ),
      1000
    );
    expect(s.status).toBe("error");
    expect(s.error).toBe("引擎处理出错");
  });
});
