import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── mock memoryClient：所有 API 返回可控 promise ──
const mockModule = vi.hoisted(() => ({
  getMemoryStatus: vi.fn(),
  getMemoryConfig: vi.fn(),
  reloadMemory: vi.fn(),
  clearMemory: vi.fn(),
  createFact: vi.fn(),
  deleteFact: vi.fn(),
  patchFact: vi.fn(),
  exportMemory: vi.fn(),
  importMemory: vi.fn(),
}));

vi.mock("../src/lib/memoryClient", () => ({
  __esModule: true,
  ...mockModule,
  isMemoryApiError: (e: unknown) =>
    typeof e === "object" && e !== null && "message" in e && "status" in e,
}));

import { MemorySettings } from "../src/components/MemorySettings";

// ── 固定数据 ──

const memoryData = {
  version: "1.0",
  lastUpdated: "2026-07-31T10:00:00Z",
  facts: [
    {
      id: "fact_a",
      content: "User prefers TypeScript",
      category: "preference",
      confidence: 0.9,
      createdAt: "2026-07-30T08:00:00Z",
      source: "thr_1",
    },
    {
      id: "fact_b",
      content: "Working on QiLin",
      category: "context",
      confidence: 0.6,
      createdAt: "2026-07-29T08:00:00Z",
      source: "unknown",
    },
  ],
};

const memoryConfig = {
  enabled: true,
  mode: "middleware" as const,
  injection_enabled: true,
  shutdown_flush_timeout_seconds: 30,
  manager_class: "deermem",
  backend_config: { max_facts: 100, storage_path: "/x/.qilin" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockModule.getMemoryStatus.mockResolvedValue({ config: memoryConfig, data: memoryData });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 加载与展示 ───────────────────────────────────────────────────────

describe("MemorySettings 加载与展示", () => {
  it("挂载时调用 getMemoryStatus 并展示 config + facts", async () => {
    render(<MemorySettings />);
    await waitFor(() => {
      expect(screen.getByText("记忆配置")).toBeInTheDocument();
    });
    expect(mockModule.getMemoryStatus).toHaveBeenCalledTimes(1);
    // 配置展示
    expect(screen.getByText("已启用")).toBeInTheDocument();
    expect(screen.getByText("中间件（被动摘要）")).toBeInTheDocument();
    expect(screen.getByText("deermem")).toBeInTheDocument();
    // 后端私有配置
    expect(screen.getByText("max_facts")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    // facts 列表
    expect(screen.getByText("User prefers TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Working on QiLin")).toBeInTheDocument();
    expect(screen.getByText("共 2 条记忆")).toBeInTheDocument();
  });

  it("getMemoryStatus 返回 501 时降级为 config-only", async () => {
    mockModule.getMemoryStatus.mockRejectedValue({ message: "not supported", status: 501 });
    mockModule.getMemoryConfig.mockResolvedValue({ ...memoryConfig, enabled: false });
    render(<MemorySettings />);
    await waitFor(() => {
      expect(screen.getByText("已停用")).toBeInTheDocument();
    });
    expect(screen.getByText(/不支持完整记忆文档读写/)).toBeInTheDocument();
    // 危险操作按钮应被禁用
    const clearBtn = screen.getByTitle("清空所有记忆数据（不可恢复）") as HTMLButtonElement;
    expect(clearBtn.disabled).toBe(true);
  });

  it("网络/其他错误时展示错误消息", async () => {
    mockModule.getMemoryStatus.mockRejectedValue({ message: "引擎未启动", status: 0 });
    render(<MemorySettings />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("引擎未启动");
    });
  });
});

// ── fact CRUD ────────────────────────────────────────────────────────

describe("MemorySettings fact CRUD", () => {
  it("新增 fact：填写内容后提交调用 createFact", async () => {
    mockModule.createFact.mockResolvedValue({ ...memoryData, facts: [...memoryData.facts] });
    render(<MemorySettings />);
    await waitFor(() => screen.getByText("User prefers TypeScript"));

    fireEvent.click(screen.getByText("新增"));
    const textarea = await screen.findByPlaceholderText(/用户偏好简洁回复/);
    fireEvent.change(textarea, { target: { value: "喜欢深色主题" } });
    fireEvent.click(screen.getAllByText("保存")[0]);

    await waitFor(() => {
      expect(mockModule.createFact).toHaveBeenCalledWith({
        content: "喜欢深色主题",
        category: "context",
        confidence: 0.5,
      });
    });
  });

  it("删除 fact：确认后调用 deleteFact", async () => {
    mockModule.deleteFact.mockResolvedValue({ ...memoryData, facts: [memoryData.facts[1]] });
    render(<MemorySettings />);
    await waitFor(() => screen.getByText("User prefers TypeScript"));

    // 点第一条的删除按钮
    const delBtns = screen.getAllByLabelText("删除");
    fireEvent.click(delBtns[0]);
    // ConfirmDialog 出现，点"删除"确认
    const confirmDelete = await screen.findByRole("alertdialog");
    fireEvent.click(confirmDelete.querySelector("button.confirm-btn.danger, button:not(.cancel)")!);

    await waitFor(() => {
      expect(mockModule.deleteFact).toHaveBeenCalledWith("fact_a");
    });
  });
});

// ── 危险操作：清空 ───────────────────────────────────────────────────

describe("MemorySettings 清空", () => {
  it("清空全部：二次确认后调用 clearMemory", async () => {
    mockModule.clearMemory.mockResolvedValue({ ...memoryData, facts: [] });
    render(<MemorySettings />);
    await waitFor(() => screen.getByText("共 2 条记忆"));

    fireEvent.click(screen.getByTitle("清空所有记忆数据（不可恢复）"));
    const dialog = await screen.findByRole("alertdialog");
    // 点确认（danger 按钮中的清空）
    const confirmBtn = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent === "清空"
    )!;
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockModule.clearMemory).toHaveBeenCalledTimes(1);
    });
  });

  it("清空：取消确认则不调用 clearMemory", async () => {
    render(<MemorySettings />);
    await waitFor(() => screen.getByText("共 2 条记忆"));

    fireEvent.click(screen.getByTitle("清空所有记忆数据（不可恢复）"));
    const dialog = await screen.findByRole("alertdialog");
    const cancelBtn = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent === "取消"
    )!;
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(mockModule.clearMemory).not.toHaveBeenCalled();
  });
});

// ── 重新加载 ─────────────────────────────────────────────────────────

describe("MemorySettings 重新加载", () => {
  it("点击重新加载调用 reloadMemory", async () => {
    mockModule.reloadMemory.mockResolvedValue(memoryData);
    render(<MemorySettings />);
    await waitFor(() => screen.getByText("共 2 条记忆"));

    fireEvent.click(screen.getByTitle("从存储文件重新加载（刷新缓存）"));
    await waitFor(() => {
      expect(mockModule.reloadMemory).toHaveBeenCalledTimes(1);
    });
  });
});
