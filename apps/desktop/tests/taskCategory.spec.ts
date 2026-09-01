
import { describe, expect, it } from "vitest";
import {
  classifyTaskCategory,
  groupSessionsByTaskCategory,
  DEFAULT_COLLAPSED_TASK_GROUPS,
} from "../src/lib/taskCategory";
import type { ChatSession } from "../src/lib/sessionStore";

function mkSession(id: string, title: string): ChatSession {
  return {
    id,
    title,
    createdAt: "2026-09-01T09:00:00Z",
    updatedAt: "09-01 17:00",
    updatedAtIso: "2026-09-01T09:00:00Z",
    metadata: {},
    messages: [],
    reportMarkdown: ""
  } as unknown as ChatSession;
}

describe("classifyTaskCategory：按标题关键词推导任务种类", () => {
  it("存量任务标题——策略回测类", () => {
    expect(classifyTaskCategory("中证A500-MACD增强版趋势策略")).toBe("backtest");
    expect(classifyTaskCategory("中证500动量策略")).toBe("backtest");
    expect(classifyTaskCategory("小市值平台放量突破策略")).toBe("backtest");
    expect(classifyTaskCategory("双均线策略回测验证")).toBe("backtest");
    // 「选股策略回测验证」按编排语义归回测而非选股
    expect(classifyTaskCategory("高股息选股策略回测验证")).toBe("backtest");
  });

  it("因子研究类（最特异，先于回测/选股）", () => {
    expect(classifyTaskCategory("多因子选股回测")).toBe("factor");
    expect(classifyTaskCategory("测一下反转因子是否有效")).toBe("factor");
    expect(classifyTaskCategory("动量因子 IC/IR 分层回测")).toBe("factor");
  });

  it("选股扫描类", () => {
    expect(classifyTaskCategory("高股息策略选股")).toBe("screening");
    expect(classifyTaskCategory("帮我筛选沪深300低估值股票")).toBe("screening");
    expect(classifyTaskCategory("涨停龙头策略扫描")).toBe("screening");
  });

  it("报告研报类（先于衍生品：交付物语义优先）", () => {
    expect(classifyTaskCategory("生成本周可转债周度全景报告")).toBe("report");
    expect(classifyTaskCategory("券商半导体行业研报综述")).toBe("report");
  });

  it("衍生品专题类", () => {
    expect(classifyTaskCategory("可转债双低轮动分析")).toBe("derivative");
    expect(classifyTaskCategory("50ETF期权波动率曲面")).toBe("derivative");
  });

  it("宏观行业类", () => {
    expect(classifyTaskCategory("最新GDP与CPI数据解读")).toBe("macro");
    expect(classifyTaskCategory("半导体行业产业链分析")).toBe("macro");
  });

  it("市场分析类（先于个股分析的「分析」兜底）", () => {
    expect(classifyTaskCategory("完成今日市场联动分析")).toBe("market");
    expect(classifyTaskCategory("完成上周市场联动分析")).toBe("market");
    expect(classifyTaskCategory("完成本周A股开盘前的前瞻分析")).toBe("market");
    expect(classifyTaskCategory("今日大盘情绪与资金流向研判")).toBe("market");
    // 个股分析不受影响
    expect(classifyTaskCategory("贵州茅台(600519)基本面分析")).toBe("stock");
    expect(classifyTaskCategory("宁德时代缠论技术面研究")).toBe("stock");
  });

  it("个股分析类（含 6 位代码）", () => {
    expect(classifyTaskCategory("贵州茅台(600519)基本面分析")).toBe("stock");
    expect(classifyTaskCategory("宁德时代缠论技术面研究")).toBe("stock");
  });

  it("兜底：无命中归通用其他", () => {
    expect(classifyTaskCategory("随便聊聊最近的想法")).toBe("general");
    expect(classifyTaskCategory("")).toBe("general");
    // 「大盘」属于市场分析，不再落入兜底
    expect(classifyTaskCategory("帮我看看今天大盘")).toBe("market");
  });
});

describe("groupSessionsByTaskCategory：汇总分组", () => {
  it("按固定种类顺序输出非空组，组内保持传入顺序", () => {
    const sessions = [
      mkSession("0", "完成今日市场联动分析"),
      mkSession("1", "贵州茅台基本面分析"),
      mkSession("2", "高股息策略选股"),
      mkSession("3", "双均线回测"),
      mkSession("4", "动量因子检验"),
      mkSession("5", "中证500动量策略"),
      mkSession("6", "随便聊聊最近的想法")
    ];
    const groups = groupSessionsByTaskCategory(sessions);
    expect(groups.map((g) => g.key)).toEqual([
      "market",
      "stock",
      "screening",
      "backtest",
      "factor",
      "general"
    ]);
    expect(groups[0].sessions.map((s) => s.id)).toEqual(["0"]);
    expect(groups.find((g) => g.key === "stock")?.sessions.map((s) => s.id)).toEqual([
      "1"
    ]);
    expect(groups.find((g) => g.key === "backtest")?.sessions.map((s) => s.id)).toEqual([
      "3",
      "5"
    ]);
  });

  it("空列表返回空分组；全部分组默认折叠（用户手动展开）", () => {
    expect(groupSessionsByTaskCategory([])).toEqual([]);
    for (const key of ["stock", "screening", "backtest", "factor", "report", "macro", "derivative", "general", "archived"] as const) {
      expect(DEFAULT_COLLAPSED_TASK_GROUPS.has(key)).toBe(true);
    }
  });
});
