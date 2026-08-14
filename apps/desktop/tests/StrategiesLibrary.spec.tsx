import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── mock strategiesClient ──
const mockModule = vi.hoisted(() => ({
  listStrategies: vi.fn(),
  listStrategyVersions: vi.fn(),
  listStrategyRuns: vi.fn(),
  compareStrategyRuns: vi.fn(),
  getStrategyRunEquity: vi.fn(),
}));

vi.mock("../src/lib/strategiesClient", () => ({
  __esModule: true,
  ...mockModule,
  isStrategiesApiError: (e: unknown) =>
    typeof e === "object" && e !== null && "message" in e && "status" in e,
}));

import { StrategiesLibrary } from "../src/components/StrategiesLibrary";

const strategy = {
  strategy_id: "stg_test",
  name: "中证500动量",
  hypothesis: "20日动量延续",
  status: "researching",
  current_version: 2,
  created_at: "2026-08-14T10:00:00Z",
  updated_at: "2026-08-14T12:00:00Z",
  latest_run: null,
};

const versions = [
  {
    strategy_id: "stg_test",
    version: 1,
    parent_version: 0,
    code_sha256: "abc123def456",
    code_bytes: 2048,
    params: { lookback: 20 },
    change_note: "初始版本",
    created_at: "2026-08-14T10:00:00Z",
  },
  {
    strategy_id: "stg_test",
    version: 2,
    parent_version: 1,
    code_sha256: "fff123ddd456",
    code_bytes: 2560,
    params: { lookback: 30 },
    change_note: "回看期 20→30",
    created_at: "2026-08-14T12:00:00Z",
  },
];

const run = (id: string, version: number, total: number) => ({
  run_id: id,
  strategy_id: "stg_test",
  version,
  data_start: "20240813",
  data_end: "20260813",
  rules: { enforce_a_share_rules: true },
  metrics: {
    total_return_pct: total,
    annual_return_pct: total / 2,
    sharpe_ratio: 1.2,
    max_drawdown_pct: -20,
    win_rate_pct: 51,
    trade_count: 900,
  },
  equity_path: "stg_test/runs/" + id + "/equity.json",
  trades_path: null,
  created_at: "2026-08-14T12:30:00Z",
});

const runs = [run("srun_aaaaaaaa", 1, 100), run("srun_bbbbbbbb", 2, 150)];

beforeEach(() => {
  vi.clearAllMocks();
  mockModule.listStrategies.mockResolvedValue([strategy]);
  mockModule.listStrategyVersions.mockResolvedValue(versions);
  mockModule.listStrategyRuns.mockResolvedValue(runs);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StrategiesLibrary", () => {
  it("加载策略列表，选中后展示版本时间线与运行表", async () => {
    render(<StrategiesLibrary onBack={() => undefined} onRerun={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText("中证500动量")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("中证500动量"));

    await waitFor(() => {
      expect(mockModule.listStrategyVersions).toHaveBeenCalledWith("stg_test");
    });
    expect(await screen.findByText("回看期 20→30")).toBeInTheDocument();
    expect(screen.getByText("回测运行（勾选 2-4 个对比）")).toBeInTheDocument();
    // 两个 run 的收益
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("空策略库显示引导提示", async () => {
    mockModule.listStrategies.mockResolvedValue([]);
    render(<StrategiesLibrary onBack={() => undefined} onRerun={() => undefined} />);
    expect(await screen.findByText(/让 agent 做「策略研究回测」并入库版本/)).toBeInTheDocument();
  });

  it("勾选两个 run 触发对比与净值叠加（同口径标注）", async () => {
    mockModule.compareStrategyRuns.mockResolvedValue({
      strategy_id: "stg_test",
      runs,
      comparable: true,
      notes: [],
    });
    mockModule.getStrategyRunEquity.mockImplementation(async (_sid: string, runId: string) => ({
      run_id: runId,
      version: runId.includes("a") ? 1 : 2,
      data_start: "20240813",
      data_end: "20260813",
      equity: [{ date: "2024-08-13", equity: 1_000_000 }, { date: "2024-08-14", equity: 1_100_000 }, { date: "2024-08-15", equity: 1_200_000 }],
    }));

    render(<StrategiesLibrary onBack={() => undefined} onRerun={() => undefined} />);
    fireEvent.click(await screen.findByText("中证500动量"));
    await waitFor(() => {
      expect(screen.getByText("回测运行（勾选 2-4 个对比）")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    await waitFor(() => {
      expect(mockModule.compareStrategyRuns).toHaveBeenCalledWith("stg_test", ["srun_aaaaaaaa", "srun_bbbbbbbb"]);
    });
    expect(await screen.findByText("版本对比（同口径，可严格对比）")).toBeInTheDocument();
    // 净值叠加 SVG 渲染（归一化折线）
    expect(document.querySelector(".strategies-equity-chart svg")).toBeTruthy();
  });

  it("对比口径不一致时显示警示", async () => {
    mockModule.compareStrategyRuns.mockResolvedValue({
      strategy_id: "stg_test",
      runs,
      comparable: false,
      notes: ["所选运行的数据区间或交易规则配置不一致，对比仅供粗略参考；"],
    });
    mockModule.getStrategyRunEquity.mockResolvedValue(null);

    render(<StrategiesLibrary onBack={() => undefined} onRerun={() => undefined} />);
    fireEvent.click(await screen.findByText("中证500动量"));
    await waitFor(() => {
      expect(screen.getByText("回测运行（勾选 2-4 个对比）")).toBeInTheDocument();
    });
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(await screen.findByText("版本对比（口径不一致，仅供参考）")).toBeInTheDocument();
    expect(screen.getByText(/数据区间或交易规则配置不一致/)).toBeInTheDocument();
  });

  it("点「重跑本版本」把含策略与版本的 prompt 交给 onRerun", async () => {
    const onRerun = vi.fn();
    render(<StrategiesLibrary onBack={() => undefined} onRerun={onRerun} />);
    fireEvent.click(await screen.findByText("中证500动量"));

    const buttons = await screen.findAllByRole("button", { name: /重跑本版本/ });
    fireEvent.click(buttons[0]); // 时间线最新在前，第一个即最新版本 v2

    expect(onRerun).toHaveBeenCalledTimes(1);
    const prompt = onRerun.mock.calls[0][0] as string;
    expect(prompt).toContain("stg_test");
    expect(prompt).toContain("v2 版本");
  });

  it("顶栏刷新按钮重拉列表与选中策略的详情", async () => {
    render(<StrategiesLibrary onBack={() => undefined} onRerun={() => undefined} />);
    fireEvent.click(await screen.findByText("中证500动量"));
    await waitFor(() => {
      expect(mockModule.listStrategyRuns).toHaveBeenCalledWith("stg_test");
    });
    const callsBefore = mockModule.listStrategyVersions.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "刷新策略库" }));
    await waitFor(() => {
      expect(mockModule.listStrategyVersions.mock.calls.length).toBeGreaterThan(callsBefore);
    });
    expect(mockModule.listStrategies).toHaveBeenCalledTimes(2);
    expect(mockModule.listStrategyRuns).toHaveBeenCalledWith("stg_test");
  });
});
