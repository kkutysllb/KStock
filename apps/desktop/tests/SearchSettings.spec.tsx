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

// ── mock extensionsClient（McpExtensionsCard 的依赖）──
const mockExtModule = vi.hoisted(() => ({
  getExtensions: vi.fn(),
}));

vi.mock("../src/lib/extensionsClient", () => ({
  __esModule: true,
  ...mockExtModule,
  isExtensionsApiError: (e: unknown) =>
    typeof e === "object" && e !== null && "message" in e && "status" in e,
}));

import { SearchSettings } from "../src/components/SearchSettings";

// ── 固定数据 ──

const toolSearchConfig = {
  enabled: false,
  auto_promote_top_k: 3,
};

const extensionsConfig = {
  middlewares: [],
  mcpServers: {},
  skills: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRuntimeModule.getRuntimeConfig.mockResolvedValue({ tool_search: toolSearchConfig });
  mockExtModule.getExtensions.mockResolvedValue(extensionsConfig);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 加载与展示 ───────────────────────────────────────────────────────

describe("SearchSettings 加载与展示", () => {
  it("加载配置后展示注意事项 + tool_search 卡 + MCP 卡", async () => {
    render(<SearchSettings />);
    await waitFor(() => {
      expect(screen.getByText("工具延迟加载")).toBeInTheDocument();
    });
    // 等 MCP 卡加载完成（getExtensions resolve 后）
    await waitFor(() => {
      expect(screen.getByText("MCP 扩展（Server 管理）")).toBeInTheDocument();
    });
    expect(screen.getByText(/MCP server 变更需重启 gateway 生效/)).toBeInTheDocument();
  });

  it("加载时展示 loading 占位", () => {
    mockRuntimeModule.getRuntimeConfig.mockReturnValue(new Promise(() => {}));
    render(<SearchSettings />);
    expect(screen.getByText("加载搜索配置…")).toBeInTheDocument();
  });

  it("加载失败展示错误消息", async () => {
    mockRuntimeModule.getRuntimeConfig.mockRejectedValue({
      message: "引擎未启动",
      status: 0,
    });
    render(<SearchSettings />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("引擎未启动");
    });
  });
});

// ── tool_search 编辑与保存 ─────────────────────────────────────────

describe("SearchSettings tool_search 编辑", () => {
  it("启用延迟加载后保存调用 PUT tool_search", async () => {
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "tool_search",
      value: { ...toolSearchConfig, enabled: true },
    });
    render(<SearchSettings />);
    await waitFor(() => {
      expect(screen.getByText("工具延迟加载")).toBeInTheDocument();
    });

    // 切换启用开关
    const checkbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);

    // tool_search 卡的保存按钮（第一张卡）
    const saveBtns = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(mockRuntimeModule.updateRuntimeConfigSection).toHaveBeenCalledTimes(1);
    });
    const [section, value] = mockRuntimeModule.updateRuntimeConfigSection.mock.calls[0];
    expect(section).toBe("tool_search");
    expect(value.enabled).toBe(true);
  });
});
