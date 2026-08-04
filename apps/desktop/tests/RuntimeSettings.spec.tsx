import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── mock runtimeConfigClient：所有 API 返回可控 promise ──
const mockRuntimeModule = vi.hoisted(() => ({
  getRuntimeConfig: vi.fn(),
  updateRuntimeConfigSection: vi.fn(),
  updateTopLevelField: vi.fn(),
}));

vi.mock("../src/lib/runtimeConfigClient", () => ({
  __esModule: true,
  ...mockRuntimeModule,
  isRuntimeConfigApiError: (e: unknown) =>
    typeof e === "object" && e !== null && "message" in e && "status" in e,
}));

// mock tokenStatsClient：TokenStats 卡片的真实 fetch 在 jsdom 中必然失败，
// 会渲染第二个 role="alert"（"无法连接本地引擎"），导致 getByRole 断言歧义。
vi.mock("../src/lib/tokenStatsClient", () => ({
  __esModule: true,
  getTokenStats: vi.fn().mockResolvedValue({
    days: [],
    total_tokens: 0,
    total_runs: 0,
    completed_tasks: 0,
    api_calls: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_hit_rate: 0,
  }),
  isTokenStatsApiError: () => false,
}));

import { RuntimeSettings } from "../src/components/RuntimeSettings";

// ── 固定数据 ──

const tokenUsageConfig = { enabled: true };

const tokenBudgetConfig = {
  enabled: false,
  max_tokens: 200000,
  max_input_tokens: null,
  max_output_tokens: null,
  warn_threshold: 0.8,
  hard_stop_threshold: 1.0,
  max_budget_extensions: 2,
};

const fullRuntimeConfig = {
  token_usage: tokenUsageConfig,
  token_budget: tokenBudgetConfig,
  max_recursion_limit: 1000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 加载与展示 ───────────────────────────────────────────────────────

describe("RuntimeSettings 加载与展示", () => {
  it("加载配置后展示注意事项 + 三张卡片", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue(fullRuntimeConfig);
    render(<RuntimeSettings />);
    await waitFor(() => {
      expect(screen.getByText("Token 用量统计")).toBeInTheDocument();
    });
    // 三张卡片标题
    expect(screen.getByText("Token 用量统计")).toBeInTheDocument();
    expect(screen.getByText("Token 预算限制")).toBeInTheDocument();
    expect(screen.getByText("递归深度上限")).toBeInTheDocument();
    // 注意事项
    expect(
      screen.getByText(/token 用量\/预算需重启 gateway 生效/)
    ).toBeInTheDocument();
  });

  it("加载时展示 loading 占位", () => {
    mockRuntimeModule.getRuntimeConfig.mockReturnValue(new Promise(() => {}));
    render(<RuntimeSettings />);
    expect(screen.getByText("加载运行预算配置…")).toBeInTheDocument();
  });

  it("加载失败展示错误消息", async () => {
    mockRuntimeModule.getRuntimeConfig.mockRejectedValue({
      message: "引擎未启动",
      status: 0,
    });
    render(<RuntimeSettings />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("引擎未启动");
    });
  });
});

// ── token_usage 编辑与保存 ──────────────────────────────────────────

describe("RuntimeSettings token_usage 编辑", () => {
  it("切换 Token 用量统计开关后保存调用 PUT token_usage", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue(fullRuntimeConfig);
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "token_usage",
      value: { enabled: false },
    });
    render(<RuntimeSettings />);
    await waitFor(() => {
      expect(screen.getByText("Token 用量统计")).toBeInTheDocument();
    });

    // 第一张卡的 checkbox（Token 用量统计开关）
    const checkbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);

    // 找第一张卡的保存按钮（Token 用量统计卡片内）
    const saveBtns = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(
        mockRuntimeModule.updateRuntimeConfigSection
      ).toHaveBeenCalledTimes(1);
    });
    const [section, value] =
      mockRuntimeModule.updateRuntimeConfigSection.mock.calls[0];
    expect(section).toBe("token_usage");
    expect(value.enabled).toBe(false);
  });
});

// ── token_budget 编辑与保存 ─────────────────────────────────────────

describe("RuntimeSettings token_budget 编辑", () => {
  it("启用预算限制 + 修改 max_tokens 后保存调用 PUT token_budget", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue(fullRuntimeConfig);
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "token_budget",
      value: { ...tokenBudgetConfig, enabled: true, max_tokens: 500000 },
    });
    render(<RuntimeSettings />);
    await waitFor(() => {
      expect(screen.getByText("Token 预算限制")).toBeInTheDocument();
    });

    // 启用预算限制开关（第二张卡的 checkbox）
    const checkboxes = screen.getAllByRole("checkbox");
    const budgetCheckbox = checkboxes[1];
    fireEvent.click(budgetCheckbox);

    // 修改 max_tokens（200000 → 500000）
    const inputs = screen.getAllByRole("spinbutton");
    const maxTokensInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "200000"
    ) as HTMLInputElement;
    fireEvent.change(maxTokensInput, { target: { value: "500000" } });

    // 点第二张卡的保存按钮
    const saveBtns = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[1]);

    await waitFor(() => {
      expect(
        mockRuntimeModule.updateRuntimeConfigSection
      ).toHaveBeenCalledTimes(1);
    });
    const [section, value] =
      mockRuntimeModule.updateRuntimeConfigSection.mock.calls[0];
    expect(section).toBe("token_budget");
    expect(value.enabled).toBe(true);
    expect(value.max_tokens).toBe(500000);
    // 未编辑字段（预算续跑次数）应保留在保存值中，不会被覆盖丢弃
    expect(value.max_budget_extensions).toBe(2);
  });
});

// ── max_recursion_limit 编辑与保存 ──────────────────────────────────

describe("RuntimeSettings max_recursion_limit 编辑", () => {
  it("修改递归上限后保存调用 updateTopLevelField", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue(fullRuntimeConfig);
    mockRuntimeModule.updateTopLevelField.mockResolvedValue({
      section: "max_recursion_limit",
      value: { max_recursion_limit: 2000 },
    });
    render(<RuntimeSettings />);
    await waitFor(() => {
      expect(screen.getByText("递归深度上限")).toBeInTheDocument();
    });

    // 修改最大递归轮数（1000 → 2000）
    const inputs = screen.getAllByRole("spinbutton");
    const recursionInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "1000"
    ) as HTMLInputElement;
    fireEvent.change(recursionInput, { target: { value: "2000" } });

    // 点最后一张卡的保存按钮
    const saveBtns = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[saveBtns.length - 1]);

    await waitFor(() => {
      expect(mockRuntimeModule.updateTopLevelField).toHaveBeenCalledTimes(1);
    });
    const [field, value] = mockRuntimeModule.updateTopLevelField.mock.calls[0];
    expect(field).toBe("max_recursion_limit");
    expect(value).toBe(2000);
  });

  it("保存递归上限失败展示错误消息", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue(fullRuntimeConfig);
    mockRuntimeModule.updateTopLevelField.mockRejectedValue(
      new Error("max_recursion_limit 必须 >= 1")
    );
    render(<RuntimeSettings />);
    await waitFor(() => {
      expect(screen.getByText("递归深度上限")).toBeInTheDocument();
    });

    // 修改递归上限为非法值
    const inputs = screen.getAllByRole("spinbutton");
    const recursionInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "1000"
    ) as HTMLInputElement;
    fireEvent.change(recursionInput, { target: { value: "0" } });

    const saveBtns = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[saveBtns.length - 1]);

    await waitFor(() => {
      expect(screen.getByText("max_recursion_limit 必须 >= 1")).toBeInTheDocument();
    });
  });
});
