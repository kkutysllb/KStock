import { describe, expect, it } from "vitest";
import {
  STAGE_ANALYSIS,
  STAGE_DONE,
  STAGE_PREPARE,
  STAGE_REPORT,
  STAGE_SEARCH,
  inferStage
} from "../src/lib/stageInferrer";
import type { SseFrame } from "../src/lib/sseParser";

function frame(event: string, data: unknown): SseFrame {
  return { event, data };
}

function msg(message: Record<string, unknown>): unknown {
  return [message, {}];
}

describe("stageInferrer 事件→阶段映射", () => {
  it("end → 完成（终态）", () => {
    expect(inferStage(undefined, frame("end", null))).toBe(STAGE_DONE);
    expect(inferStage(STAGE_REPORT, frame("end", null))).toBe(STAGE_DONE);
  });

  it("values.artifacts 非空 → 撰写报告", () => {
    const f = frame("values", { artifacts: [{ path: "/o/r.md" }] });
    expect(inferStage(undefined, f)).toBe(STAGE_REPORT);
  });

  it("values.artifacts 空数组 → 沿用 prev", () => {
    const f = frame("values", { artifacts: [] });
    expect(inferStage(STAGE_SEARCH, f)).toBe(STAGE_SEARCH);
  });

  it("values 无 artifacts 字段 → 沿用 prev", () => {
    const f = frame("values", { messages: [] });
    expect(inferStage(STAGE_ANALYSIS, f)).toBe(STAGE_ANALYSIS);
  });

  it("task_started description 含'搜索' → 检索资料", () => {
    const f = frame("custom", { type: "task_started", task_id: "t1", description: "搜索新闻" });
    expect(inferStage(undefined, f)).toBe(STAGE_SEARCH);
  });

  it("task_started description 含'检索' → 检索资料", () => {
    const f = frame("custom", { type: "task_started", task_id: "t1", description: "检索公告" });
    expect(inferStage(undefined, f)).toBe(STAGE_SEARCH);
  });

  it("task_running message.content 含'news' → 检索资料", () => {
    const f = frame("custom", {
      type: "task_running", task_id: "t1",
      message: { content: "fetching news data" }, message_index: 1
    });
    expect(inferStage(undefined, f)).toBe(STAGE_SEARCH);
  });

  it("task_started description 不含搜索词 → 沿用 prev", () => {
    const f = frame("custom", { type: "task_started", task_id: "t1", description: "分析财报" });
    expect(inferStage(STAGE_PREPARE, f)).toBe(STAGE_PREPARE);
  });

  it("custom 非 task 类型 → 沿用 prev", () => {
    const f = frame("custom", { type: "middleware:guardrail" });
    expect(inferStage(STAGE_ANALYSIS, f)).toBe(STAGE_ANALYSIS);
  });

  it("tool_calls name 含'financial' → 数据分析", () => {
    const f = frame("messages", msg({ type: "ai", tool_calls: [{ id: "tc1", name: "get_financial_statement" }] }));
    expect(inferStage(undefined, f)).toBe(STAGE_ANALYSIS);
  });

  it("tool_calls name 含'valuation' → 数据分析", () => {
    const f = frame("messages", msg({ type: "ai", tool_calls: [{ id: "tc1", name: "kk_valuation_model" }] }));
    expect(inferStage(undefined, f)).toBe(STAGE_ANALYSIS);
  });

  it("tool_calls name 含'industry' → 数据分析", () => {
    const f = frame("messages", msg({ type: "ai", tool_calls: [{ id: "tc1", name: "industry_analysis" }] }));
    expect(inferStage(undefined, f)).toBe(STAGE_ANALYSIS);
  });

  it("tool_calls name 含中文'财务' → 数据分析", () => {
    const f = frame("messages", msg({ type: "ai", tool_calls: [{ id: "tc1", name: "查询财务数据" }] }));
    expect(inferStage(undefined, f)).toBe(STAGE_ANALYSIS);
  });

  it("tool_calls name 含'search' → 检索资料", () => {
    const f = frame("messages", msg({ type: "ai", tool_calls: [{ id: "tc1", name: "kk_news_search" }] }));
    expect(inferStage(undefined, f)).toBe(STAGE_SEARCH);
  });

  it("tool_calls 分析词优先于搜索词（同名倾向分析）", () => {
    const f = frame("messages", msg({
      type: "ai",
      tool_calls: [
        { id: "tc1", name: "news_search" },
        { id: "tc2", name: "financial_analysis" }
      ]
    }));
    expect(inferStage(undefined, f)).toBe(STAGE_ANALYSIS);
  });

  it("tool_calls name 不含关键词 → 沿用 prev", () => {
    const f = frame("messages", msg({ type: "ai", tool_calls: [{ id: "tc1", name: "write_file" }] }));
    expect(inferStage(STAGE_SEARCH, f)).toBe(STAGE_SEARCH);
  });

  it("messages 非 tool_call（纯 content）→ 沿用 prev", () => {
    const f = frame("messages", msg({ type: "ai", content: "正文" }));
    expect(inferStage(STAGE_ANALYSIS, f)).toBe(STAGE_ANALYSIS);
  });
});

describe("stageInferrer 单调推进", () => {
  it("初始 prev=undefined 无关帧 → 准备", () => {
    expect(inferStage(undefined, frame("metadata", {}))).toBe(STAGE_PREPARE);
  });

  it("准备 → 检索资料（推进）", () => {
    const f1 = frame("custom", { type: "task_started", task_id: "t1", description: "搜索" });
    expect(inferStage(STAGE_PREPARE, f1)).toBe(STAGE_SEARCH);
  });

  it("检索资料 → 数据分析（推进）", () => {
    const f = frame("messages", msg({ type: "ai", tool_calls: [{ id: "tc1", name: "financial" }] }));
    expect(inferStage(STAGE_SEARCH, f)).toBe(STAGE_ANALYSIS);
  });

  it("不回退：撰写报告 + 后续 tool_call → 保持撰写报告", () => {
    const f = frame("messages", msg({ type: "ai", tool_calls: [{ id: "tc1", name: "financial" }] }));
    expect(inferStage(STAGE_REPORT, f)).toBe(STAGE_REPORT);
  });

  it("不回退：数据分析 + 搜索类 task → 保持数据分析", () => {
    const f = frame("custom", { type: "task_started", task_id: "t1", description: "搜索新闻" });
    expect(inferStage(STAGE_ANALYSIS, f)).toBe(STAGE_ANALYSIS);
  });

  it("完成是终态：后续任何帧都保持完成", () => {
    const f = frame("messages", msg({ type: "ai", tool_calls: [{ id: "tc1", name: "financial" }] }));
    expect(inferStage(STAGE_DONE, f)).toBe(STAGE_DONE);
  });

  it("同阶段保持不变（检索资料 + 搜索 task → 仍检索资料）", () => {
    const f = frame("custom", { type: "task_started", task_id: "t2", description: "搜索公告" });
    expect(inferStage(STAGE_SEARCH, f)).toBe(STAGE_SEARCH);
  });

  it("完整推进序列：准备→检索→分析→报告→完成", () => {
    let stage: string | undefined;
    stage = inferStage(stage, frame("metadata", {}));          // 准备
    expect(stage).toBe(STAGE_PREPARE);
    stage = inferStage(stage, frame("custom", { type: "task_started", task_id: "t1", description: "搜索新闻" }));
    expect(stage).toBe(STAGE_SEARCH);
    stage = inferStage(stage, frame("messages", msg({ type: "ai", tool_calls: [{ id: "tc1", name: "financial" }] })));
    expect(stage).toBe(STAGE_ANALYSIS);
    stage = inferStage(stage, frame("values", { artifacts: [{ path: "/o/r.md" }] }));
    expect(stage).toBe(STAGE_REPORT);
    stage = inferStage(stage, frame("end", null));
    expect(stage).toBe(STAGE_DONE);
  });
});

describe("stageInferrer 防御性", () => {
  it("messages data 非数组 → 沿用 prev", () => {
    const f = frame("messages", { type: "ai", tool_calls: [{ name: "financial" }] });
    expect(inferStage(STAGE_PREPARE, f)).toBe(STAGE_PREPARE);
  });

  it("messages data 空数组 → 沿用 prev", () => {
    const f = frame("messages", []);
    expect(inferStage(STAGE_SEARCH, f)).toBe(STAGE_SEARCH);
  });

  it("custom data 非对象 → 沿用 prev", () => {
    const f = frame("custom", "string-data");
    expect(inferStage(STAGE_ANALYSIS, f)).toBe(STAGE_ANALYSIS);
  });

  it("values data 非对象 → 沿用 prev", () => {
    const f = frame("values", null);
    expect(inferStage(STAGE_SEARCH, f)).toBe(STAGE_SEARCH);
  });
});
