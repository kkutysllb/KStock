import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── mock runtimeConfigClient：所有 API 返回可控 promise ──
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

import { DatabaseSettings } from "../src/components/DatabaseSettings";

// ── 固定数据 ──

const sqliteConfig = {
  backend: "sqlite" as const,
  sqlite_dir: ".qilin/data",
  postgres_url: "",
  echo_sql: false,
  pool_size: 5,
  pool_recycle: 300,
  command_timeout: 30,
  checkpoint_channel_mode: "full" as const,
};

const postgresConfig = {
  backend: "postgres" as const,
  sqlite_dir: "",
  postgres_url: "$DATABASE_URL",
  echo_sql: false,
  pool_size: 10,
  pool_recycle: 600,
  command_timeout: 60,
  checkpoint_channel_mode: "delta" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 加载与展示 ───────────────────────────────────────────────────────

describe("DatabaseSettings 加载与展示", () => {
  it("加载 sqlite 配置后展示注意事项 + 字段 + 当前值卡", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue({ database: sqliteConfig });
    render(<DatabaseSettings />);
    await waitFor(() => {
      expect(screen.getByText("数据库配置")).toBeInTheDocument();
    });
    // 注意事项卡
    expect(screen.getByText(/后端切换需重启 gateway 生效/)).toBeInTheDocument();
    // 当前值卡标题（与字段 label 区分开）
    expect(screen.getByText("当前 runtime.yaml 值")).toBeInTheDocument();
    // RuntimeConfigCard 已渲染（字段渲染细节由 RuntimeConfigCard.spec 覆盖）
    expect(screen.getByText("数据库配置")).toBeInTheDocument();
  });

  it("加载 postgres 配置后展示 Postgres URL（$ 引用原样展示）", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue({ database: postgresConfig });
    render(<DatabaseSettings />);
    await waitFor(() => {
      expect(screen.getByText("$DATABASE_URL")).toBeInTheDocument();
    });
  });

  it("加载失败展示错误消息", async () => {
    mockRuntimeModule.getRuntimeConfig.mockRejectedValue({ message: "引擎未启动", status: 0 });
    render(<DatabaseSettings />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("引擎未启动");
    });
  });

  it("加载时展示 loading 占位", () => {
    mockRuntimeModule.getRuntimeConfig.mockReturnValue(new Promise(() => {})); // 永不 resolve
    render(<DatabaseSettings />);
    expect(screen.getByText("加载数据库配置…")).toBeInTheDocument();
  });
});

// ── 编辑与保存 ──────────────────────────────────────────────────────

describe("DatabaseSettings 编辑与保存", () => {
  it("切换 backend select 后保存调用 PUT database", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue({ database: sqliteConfig });
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "database",
      value: { ...sqliteConfig, backend: "postgres" },
    });
    render(<DatabaseSettings />);
    await waitFor(() => {
      expect(screen.getByText("数据库配置")).toBeInTheDocument();
    });

    // 修改 backend：sqlite（单节点）→ postgres（多节点）
    const backendSelect = screen.getByDisplayValue("sqlite（单节点）") as HTMLSelectElement;
    fireEvent.change(backendSelect, { target: { value: "postgres" } });

    // 点保存
    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(mockRuntimeModule.updateRuntimeConfigSection).toHaveBeenCalledTimes(1);
    });
    const [section, value] = mockRuntimeModule.updateRuntimeConfigSection.mock.calls[0];
    expect(section).toBe("database");
    expect(value.backend).toBe("postgres");
  });

  it("保存失败展示错误消息（RuntimeConfigCard 回显）", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue({ database: sqliteConfig });
    mockRuntimeModule.updateRuntimeConfigSection.mockRejectedValue(
      new Error("写入 runtime.yaml 失败")
    );
    render(<DatabaseSettings />);
    await waitFor(() => {
      expect(screen.getByText("数据库配置")).toBeInTheDocument();
    });

    // 修改 pool_recycle
    const inputs = screen.getAllByRole("spinbutton");
    const recycleInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "300"
    ) as HTMLInputElement;
    fireEvent.change(recycleInput, { target: { value: "600" } });

    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("写入 runtime.yaml 失败");
    });
  });

  it("保存成功后展示 savedHint", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue({ database: sqliteConfig });
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "database",
      value: sqliteConfig,
    });
    render(<DatabaseSettings />);
    await waitFor(() => {
      expect(screen.getByText("数据库配置")).toBeInTheDocument();
    });

    // 修改 command_timeout
    const inputs = screen.getAllByRole("spinbutton");
    const timeoutInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "30"
    ) as HTMLInputElement;
    fireEvent.change(timeoutInput, { target: { value: "60" } });

    const saveBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(
        screen.getByText(/已写入 runtime.yaml/)
      ).toBeInTheDocument();
    });
  });
});
