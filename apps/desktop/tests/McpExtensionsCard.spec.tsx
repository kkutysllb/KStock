import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── mock extensionsClient ──
const mockExtModule = vi.hoisted(() => ({
  getExtensions: vi.fn(),
  createMcpServer: vi.fn(),
  updateMcpServer: vi.fn(),
  deleteMcpServer: vi.fn(),
}));

vi.mock("../src/lib/extensionsClient", () => {
  // 模板常量（与 extensionsClient.ts 中的真实模板保持一致的结构）
  const MOCK_TEMPLATES = [
    {
      id: "tushare",
      label: "Tushare 数据",
      name: "tushare-mcp",
      description: "Tushare Pro 金融数据",
      config: {
        enabled: true,
        type: "stdio",
        command: "npx",
        args: ["-y", "@tushare/mcp-server"],
        env: { TUSHARE_TOKEN: "填入你的 Tushare Pro token" },
        url: null,
        headers: {},
        description: "Tushare Pro 金融数据接口",
        tool_call_timeout: 60,
      },
      notice: "需在 Tushare Pro 官网注册获取 token",
    },
  ];
  return {
    __esModule: true,
    ...mockExtModule,
    MCP_SERVER_TEMPLATES: MOCK_TEMPLATES,
    isExtensionsApiError: (e: unknown) =>
      typeof e === "object" && e !== null && "message" in e && "status" in e,
  };
});

import { McpExtensionsCard } from "../src/components/McpExtensionsCard";

// ── 固定数据 ──

const stdioServer = {
  enabled: true,
  type: "stdio" as const,
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem"],
  env: {},
  url: null,
  headers: {},
  description: "Filesystem access",
  tool_call_timeout: null,
};

const httpServer = {
  enabled: false,
  type: "http" as const,
  command: null,
  args: [],
  env: {},
  url: "https://api.example.com/mcp",
  headers: { Authorization: "Bearer token" },
  description: "Remote API",
  tool_call_timeout: 30,
};

const configWithServers = {
  middlewares: [],
  mcpServers: {
    "filesystem": stdioServer,
    "remote-api": httpServer,
  },
  skills: {},
};

const emptyConfig = {
  middlewares: [],
  mcpServers: {},
  skills: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  // Mock window.confirm to auto-accept
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 加载与展示 ───────────────────────────────────────────────────────

describe("McpExtensionsCard 加载与展示", () => {
  it("加载配置后展示 server 列表", async () => {
    mockExtModule.getExtensions.mockResolvedValue(configWithServers);
    render(<McpExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("filesystem")).toBeInTheDocument();
    });
    expect(screen.getByText("remote-api")).toBeInTheDocument();
    expect(screen.getByText("Filesystem access")).toBeInTheDocument();
  });

  it("空配置时展示占位提示", async () => {
    mockExtModule.getExtensions.mockResolvedValue(emptyConfig);
    render(<McpExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("新增 Server")).toBeInTheDocument();
    });
    expect(screen.getByText(/暂无 MCP server/)).toBeInTheDocument();
  });

  it("加载失败展示错误消息", async () => {
    mockExtModule.getExtensions.mockRejectedValue({
      message: "引擎未启动",
      status: 0,
    });
    render(<McpExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("引擎未启动");
    });
  });
});

// ── 新增 server ────────────────────────────────────────────────────

describe("McpExtensionsCard 新增 server", () => {
  it("点击新增后展示表单，填写后调用 createMcpServer", async () => {
    mockExtModule.getExtensions.mockResolvedValue(emptyConfig);
    mockExtModule.createMcpServer.mockResolvedValue({ name: "test", action: "created" });
    render(<McpExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("新增 Server")).toBeInTheDocument();
    });

    // 点击新增
    fireEvent.click(screen.getByText("新增 Server"));

    // 表单出现（等待名称输入框）
    await waitFor(() => {
      expect(screen.getByPlaceholderText("my-server")).toBeInTheDocument();
    });

    // 填写名称（用 getByRole 更精确）
    const nameInput = screen.getByPlaceholderText("my-server") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "test-server" } });

    // 填写 command（默认 stdio 类型）
    const commandInput = screen.getByPlaceholderText("npx") as HTMLInputElement;
    fireEvent.change(commandInput, { target: { value: "echo" } });

    // 保存
    const saveBtn = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"))[0];
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockExtModule.createMcpServer).toHaveBeenCalledTimes(1);
    });
    const [name, config] = mockExtModule.createMcpServer.mock.calls[0];
    expect(name).toBe("test-server");
    expect(config.type).toBe("stdio");
    expect(config.command).toBe("echo");
  });

  it("stdio 类型不填 command 时展示错误", async () => {
    mockExtModule.getExtensions.mockResolvedValue(emptyConfig);
    render(<McpExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("新增 Server")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("新增 Server"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("my-server")).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText("my-server");
    fireEvent.change(nameInput, { target: { value: "test" } });

    // 不填 command 就保存
    const saveBtn = screen.getAllByRole("button").filter((b) => b.textContent?.includes("保存"))[0];
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/stdio 类型必须填写 command/)).toBeInTheDocument();
    });
    expect(mockExtModule.createMcpServer).not.toHaveBeenCalled();
  });
});

// ── 删除 server ────────────────────────────────────────────────────

describe("McpExtensionsCard 删除 server", () => {
  it("点击删除后调用 deleteMcpServer", async () => {
    mockExtModule.getExtensions.mockResolvedValue(configWithServers);
    mockExtModule.deleteMcpServer.mockResolvedValue({ name: "filesystem", action: "deleted" });
    render(<McpExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("filesystem")).toBeInTheDocument();
    });

    // 点击 filesystem 行的删除按钮
    const deleteBtns = screen.getAllByRole("button").filter((b) => b.textContent?.includes("删除"));
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(mockExtModule.deleteMcpServer).toHaveBeenCalledTimes(1);
    });
    expect(mockExtModule.deleteMcpServer.mock.calls[0][0]).toBe("filesystem");
  });
});

// ── 切换 enabled ───────────────────────────────────────────────────

describe("McpExtensionsCard 切换 enabled", () => {
  it("点击 enabled 开关后调用 updateMcpServer", async () => {
    mockExtModule.getExtensions.mockResolvedValue(configWithServers);
    mockExtModule.updateMcpServer.mockResolvedValue({ name: "filesystem", action: "updated" });
    render(<McpExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("filesystem")).toBeInTheDocument();
    });

    // filesystem 的 enabled checkbox（第一个）
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(mockExtModule.updateMcpServer).toHaveBeenCalledTimes(1);
    });
    const [name, config] = mockExtModule.updateMcpServer.mock.calls[0];
    expect(name).toBe("filesystem");
    expect(config.enabled).toBe(false); // 原来是 true，切换后 false
  });
});

// ── 从模板添加 ────────────────────────────────────────────────────

describe("McpExtensionsCard 从模板添加", () => {
  it("点击从模板添加后展示模板列表", async () => {
    mockExtModule.getExtensions.mockResolvedValue(emptyConfig);
    render(<McpExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("新增 Server")).toBeInTheDocument();
    });

    // 点击「从模板添加」
    fireEvent.click(screen.getByText(/从模板添加/));

    // 模板列表出现
    await waitFor(() => {
      expect(screen.getByText("Tushare 数据")).toBeInTheDocument();
    });
  });

  it("选中模板后预填表单字段", async () => {
    mockExtModule.getExtensions.mockResolvedValue(emptyConfig);
    mockExtModule.createMcpServer.mockResolvedValue({ name: "tushare-mcp", action: "created" });
    render(<McpExtensionsCard />);
    await waitFor(() => {
      expect(screen.getByText("新增 Server")).toBeInTheDocument();
    });

    // 点击「从模板添加」
    fireEvent.click(screen.getByText(/从模板添加/));

    // 选择 Tushare 模板
    await waitFor(() => {
      expect(screen.getByText("Tushare 数据")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Tushare 数据"));

    // 表单出现，名称已预填
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText("my-server") as HTMLInputElement;
      expect(nameInput.value).toBe("tushare-mcp");
    });

    // command 也应预填
    const commandInput = screen.getByPlaceholderText("npx") as HTMLInputElement;
    expect(commandInput.value).toBe("npx");
  });
});
