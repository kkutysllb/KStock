import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── mock runtimeConfigClient ──
const mockRuntimeModule = vi.hoisted(() => ({
  getRuntimeConfig: vi.fn(),
  updateRuntimeConfigSection: vi.fn(),
}));

vi.mock("../src/lib/runtimeConfigClient", () => ({
  __esModule: true,
  ...mockRuntimeModule,
  isRuntimeConfigApiError: (e: unknown) =>
    typeof e === "object" && e !== null && "message" in e && "status" in e,
}));

import { SubagentsSettings } from "../src/components/SubagentsSettings";

// ── 固定数据 ──

const makeAgent = (name: string, overrides: Record<string, unknown> = {}) => ({
  description: `${name} 描述`,
  system_prompt: `你是 ${name} 子代理`,
  tools: ["finance_data_search"],
  disallowed_tools: ["task", "ask_clarification", "present_files"],
  skills: ["kk-stock-analysis"],
  model: "inherit",
  max_turns: 50,
  timeout_seconds: 600,
  ...overrides,
});

const subagentsConfig = {
  timeout_seconds: 1800,
  max_turns: null,
  max_total_per_run: 6,
  token_budget: { enabled: true, max_tokens: 2000000, max_input_tokens: null, max_output_tokens: null, warn_threshold: 0.7, hard_stop_threshold: 1.0 },
  agents: {},
  custom_agents: {
    "market-data-analyst": makeAgent("market-data-analyst"),
    "stock-researcher": makeAgent("stock-researcher"),
    "chan-theory-analyst": makeAgent("chan-theory-analyst"),
    "backtest-executor": makeAgent("backtest-executor"),
    "report-writer": makeAgent("report-writer"),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRuntimeModule.getRuntimeConfig.mockResolvedValue({ subagents: subagentsConfig });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 加载与展示 ───────────────────────────────────────────────────────

describe("SubagentsSettings 加载与展示", () => {
  it("加载配置后展示 5 个预置角色名", async () => {
    render(<SubagentsSettings />);
    await waitFor(() => {
      expect(screen.getByText("全局参数")).toBeInTheDocument();
    });
    // 5 个预置角色名都应出现
    expect(screen.getByText("market-data-analyst")).toBeInTheDocument();
    expect(screen.getByText("stock-researcher")).toBeInTheDocument();
    expect(screen.getByText("chan-theory-analyst")).toBeInTheDocument();
    expect(screen.getByText("backtest-executor")).toBeInTheDocument();
    expect(screen.getByText("report-writer")).toBeInTheDocument();
  });

  it("加载时展示 loading 占位", () => {
    mockRuntimeModule.getRuntimeConfig.mockReturnValue(new Promise(() => {}));
    render(<SubagentsSettings />);
    expect(screen.getByText("加载子代理配置…")).toBeInTheDocument();
  });

  it("加载失败展示错误消息", async () => {
    mockRuntimeModule.getRuntimeConfig.mockRejectedValue({
      message: "引擎未启动",
      status: 0,
    });
    render(<SubagentsSettings />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("引擎未启动");
    });
  });

  it("展开角色卡片后显示 system_prompt", async () => {
    render(<SubagentsSettings />);
    await waitFor(() => {
      expect(screen.getByText("market-data-analyst")).toBeInTheDocument();
    });

    // 点击 market-data-analyst 角色卡片展开
    const roleHeader = screen.getByText("market-data-analyst").closest("button");
    expect(roleHeader).toBeTruthy();
    fireEvent.click(roleHeader!);

    // system_prompt 出现
    await waitFor(() => {
      expect(screen.getByText("System Prompt")).toBeInTheDocument();
      expect(screen.getByText("你是 market-data-analyst 子代理")).toBeInTheDocument();
    });
  });

  it("工具和技能 badge 正确显示", async () => {
    render(<SubagentsSettings />);
    await waitFor(() => {
      expect(screen.getByText("market-data-analyst")).toBeInTheDocument();
    });
    // 工具 badge（5 个角色都有相同工具，用 getAllByText）
    expect(screen.getAllByText(/工具：finance_data_search/).length).toBe(5);
    // 技能 badge
    expect(screen.getAllByText(/技能：kk-stock-analysis/).length).toBe(5);
  });
});

// ── 全局参数保存 ───────────────────────────────────────────────────

describe("SubagentsSettings 全局参数保存", () => {
  it("修改全局超时后保存调用 PUT subagents", async () => {
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "subagents",
      value: {},
    });
    render(<SubagentsSettings />);
    await waitFor(() => {
      expect(screen.getByText("全局参数")).toBeInTheDocument();
    });

    // 修改默认超时输入（timeout_seconds 字段，第一个 number input）
    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0], { target: { value: "3600" } });

    // 点击保存
    const saveBtn = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("保存"))[0];
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockRuntimeModule.updateRuntimeConfigSection).toHaveBeenCalledWith(
        "subagents",
        expect.objectContaining({ timeout_seconds: 3600 })
      );
    });
  });
});
