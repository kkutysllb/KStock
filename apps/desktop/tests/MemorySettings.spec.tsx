import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

// ── mock runtimeConfigClient：配置编辑卡的读写层 ──
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

const runtimeConfig = {
  memory: {
    enabled: false,
    mode: "middleware" as const,
    injection_enabled: false,
    shutdown_flush_timeout_seconds: 30,
    manager_class: "deermem",
    backend_config: {},
  },
  summarization: {
    enabled: true,
    model_name: null,
    trigger: { type: "tokens" as const, value: 32000 },
    keep: { type: "messages" as const, value: 10 },
    trim_tokens_to_summarize: 15564,
    summary_prompt: null,
    skill_file_read_tool_names: ["read_file"],
  },
  title: {
    enabled: true,
    max_words: 6,
    max_chars: 60,
    model_name: null,
  },
  database: {
    backend: "sqlite" as const,
    sqlite_dir: ".qilin/data",
    postgres_url: "",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockModule.getMemoryStatus.mockResolvedValue({ config: memoryConfig, data: memoryData });
  mockModule.getMemoryConfig.mockResolvedValue(memoryConfig);
  mockRuntimeModule.getRuntimeConfig.mockResolvedValue(runtimeConfig);
  mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
    section: "title",
    value: runtimeConfig.title,
  });
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
    // 配置展示（限定在只读生效值卡内，避免与下方配置编辑卡的 select option 文本冲突）
    const configCard = screen.getByLabelText("记忆配置");
    expect(within(configCard).getByText("已启用")).toBeInTheDocument();
    expect(within(configCard).getByText("中间件（被动摘要）")).toBeInTheDocument();
    expect(within(configCard).getByText("deermem")).toBeInTheDocument();
    // 后端私有配置
    expect(within(configCard).getByText("max_facts")).toBeInTheDocument();
    expect(within(configCard).getByText("100")).toBeInTheDocument();
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
    const dialog = await screen.findByRole("dialog", { name: "新增记忆事实" });
    const textarea = within(dialog).getByPlaceholderText(/用户偏好简洁回复/);
    fireEvent.change(textarea, { target: { value: "喜欢深色主题" } });
    // 在弹层内查找保存按钮（页面上还有多个配置编辑卡的保存按钮）
    fireEvent.click(within(dialog).getByRole("button", { name: /保存/ }));

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

// ── 配置编辑卡（memory/summarization/title）──────────────────────

describe("MemorySettings 配置编辑卡", () => {
  it("加载后展示三段配置编辑卡标题", async () => {
    render(<MemorySettings />);
    await waitFor(() => {
      expect(screen.getByText("记忆机制配置")).toBeInTheDocument();
    });
    expect(screen.getByText("摘要配置")).toBeInTheDocument();
    expect(screen.getByText("标题生成配置")).toBeInTheDocument();
  });

  it("修改标题 max_words 后保存调用 PUT title 段", async () => {
    render(<MemorySettings />);
    await waitFor(() => {
      expect(screen.getByText("标题生成配置")).toBeInTheDocument();
    });

    // 标题配置区有一个 max_words=6 的 number 输入
    const inputs = screen.getAllByRole("spinbutton");
    const maxWordsInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "6"
    ) as HTMLInputElement;
    fireEvent.change(maxWordsInput, { target: { value: "8" } });

    // 找到标题配置卡内的保存按钮：该 section 的 aria-label 是 "标题生成配置"
    const titleSection = screen.getByLabelText("标题生成配置");
    const saveBtn = Array.from(titleSection.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("保存")
    )!;
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockRuntimeModule.updateRuntimeConfigSection).toHaveBeenCalledTimes(1);
    });
    const [section, value] = mockRuntimeModule.updateRuntimeConfigSection.mock.calls[0];
    expect(section).toBe("title");
    expect(value.max_words).toBe(8);
  });

  it("保存记忆段后触发引擎生效值轮询（getMemoryConfig）", async () => {
    render(<MemorySettings />);
    await waitFor(() => {
      expect(screen.getByText("记忆机制配置")).toBeInTheDocument();
    });

    // 修改记忆段的 enabled 开关
    const memSection = screen.getByLabelText("记忆机制配置");
    const checkbox = memSection.querySelector("input[type=checkbox]") as HTMLInputElement;
    fireEvent.click(checkbox);

    const saveBtn = Array.from(memSection.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("保存")
    )!;
    fireEvent.click(saveBtn);

    // updateRuntimeConfigSection 被调用
    await waitFor(() => {
      expect(mockRuntimeModule.updateRuntimeConfigSection).toHaveBeenCalledWith(
        "memory",
        expect.objectContaining({ enabled: true })
      );
    });
    // 保存后轮询 getMemoryConfig（引擎热重载刷新生效值）
    await waitFor(
      () => {
        expect(mockModule.getMemoryConfig).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
  });

  it("配置编辑卡保存失败回显错误", async () => {
    mockRuntimeModule.updateRuntimeConfigSection.mockRejectedValue(
      new Error("runtime.yaml 不可写")
    );
    render(<MemorySettings />);
    await waitFor(() => {
      expect(screen.getByText("标题生成配置")).toBeInTheDocument();
    });

    const titleSection = screen.getByLabelText("标题生成配置");
    const inputs = titleSection.querySelectorAll("input[type=number]");
    const maxWordsInput = Array.from(inputs).find(
      (i) => (i as HTMLInputElement).value === "6"
    ) as HTMLInputElement;
    fireEvent.change(maxWordsInput, { target: { value: "10" } });

    const saveBtn = Array.from(titleSection.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("保存")
    )!;
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("runtime.yaml 不可写");
    });
  });
});
