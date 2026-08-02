import { describe, expect, it } from "vitest";
import { summarizeToolActivity } from "../src/lib/toolActivity";
import type { ToolCall } from "../src/lib/sessionStore";

const call = (patch: Partial<ToolCall>): ToolCall => ({
  ...patch,
  id: patch.id ?? crypto.randomUUID(),
  name: patch.name ?? "read_file",
  args: patch.args ?? {},
  status: patch.status ?? "done",
  result: patch.result,
});

describe("summarizeToolActivity", () => {
  it("统计调用总数和工具类别，并取最后一条非空结果", () => {
    expect(summarizeToolActivity([
      call({ name: "read_file", result: "第一条" }),
      call({ name: "bash", result: "第二条" }),
      call({ name: "read_file", result: "最终结果" }),
    ])).toEqual({
      status: "done",
      callCount: 3,
      toolCount: 2,
      latestResult: "最终结果",
    });
  });

  it("running 优先于 error，error 优先于 done", () => {
    expect(summarizeToolActivity([call({ status: "error" }), call({ status: "running" })]).status).toBe("running");
    expect(summarizeToolActivity([call({ status: "error" }), call({ status: "done" })]).status).toBe("error");
  });

  it("调用尚未全部完成时处于运行状态", () => {
    expect(summarizeToolActivity([call({ status: "running" })]).status).toBe("running");
  });

  it("运行中从最早开始时间持续累计耗时", () => {
    expect(summarizeToolActivity([
      call({ status: "running", startedAt: 1_000 }),
      call({ status: "running", startedAt: 2_000 }),
    ], 4_500).durationMs).toBe(3_500);
  });

  it("没有结果时返回空摘要，超长结果截断为单行", () => {
    expect(summarizeToolActivity([call({ result: "" })]).latestResult).toBe("");
    expect(summarizeToolActivity([call({ result: "x".repeat(120) })]).latestResult).toHaveLength(96);
    expect(summarizeToolActivity([call({ result: "x".repeat(120) })]).latestResult.endsWith("…")).toBe(true);
  });

  it("使用最早开始和最晚完成时间统计工具执行耗时", () => {
    expect(summarizeToolActivity([
      call({ startedAt: 1_000, endedAt: 4_000 }),
      call({ startedAt: 2_000, endedAt: 8_500 }),
    ]).durationMs).toBe(7_500);
  });
});
