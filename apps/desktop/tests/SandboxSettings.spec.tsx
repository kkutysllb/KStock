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

import { SandboxSettings } from "../src/components/SandboxSettings";

// ── 固定数据 ──

const defaultSandboxConfig = {
  use: "qilin.sandbox.local:LocalSandboxProvider",
  allow_host_bash: false,
  bash_command_timeout: 600,
  bash_output_max_chars: 20000,
  read_file_output_max_chars: 50000,
  ls_output_max_chars: 20000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 加载与展示 ───────────────────────────────────────────────────────

describe("SandboxSettings 加载与展示", () => {
  it("加载配置后展示注意事项 + 字段卡片", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue({
      sandbox: defaultSandboxConfig,
    });
    render(<SandboxSettings />);
    await waitFor(() => {
      expect(screen.getByText("沙箱配置")).toBeInTheDocument();
    });
    // 注意事项
    expect(screen.getByText(/沙箱配置需重启 gateway 生效/)).toBeInTheDocument();
    // 字段 label
    expect(screen.getByText("Sandbox Provider")).toBeInTheDocument();
    expect(screen.getByText("Host Bash")).toBeInTheDocument();
    expect(screen.getByText("命令超时（秒）")).toBeInTheDocument();
  });

  it("加载时展示 loading 占位", () => {
    mockRuntimeModule.getRuntimeConfig.mockReturnValue(new Promise(() => {}));
    render(<SandboxSettings />);
    expect(screen.getByText("加载沙箱配置…")).toBeInTheDocument();
  });

  it("加载失败展示错误消息", async () => {
    mockRuntimeModule.getRuntimeConfig.mockRejectedValue({
      message: "引擎未启动",
      status: 0,
    });
    render(<SandboxSettings />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("引擎未启动");
    });
  });
});

// ── 编辑与保存 ──────────────────────────────────────────────────────

describe("SandboxSettings 编辑与保存", () => {
  it("切换 Host Bash 开关后保存调用 PUT sandbox", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue({
      sandbox: defaultSandboxConfig,
    });
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "sandbox",
      value: { ...defaultSandboxConfig, allow_host_bash: true },
    });
    render(<SandboxSettings />);
    await waitFor(() => {
      expect(screen.getByText("沙箱配置")).toBeInTheDocument();
    });

    // 找到 Host Bash 的 checkbox 并切换
    const hostBashCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(hostBashCheckbox);

    // 点保存
    const saveBtns = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(mockRuntimeModule.updateRuntimeConfigSection).toHaveBeenCalledTimes(1);
    });
    const [section, value] =
      mockRuntimeModule.updateRuntimeConfigSection.mock.calls[0];
    expect(section).toBe("sandbox");
    expect(value.allow_host_bash).toBe(true);
  });

  it("修改命令超时后保存调用 PUT sandbox", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue({
      sandbox: defaultSandboxConfig,
    });
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "sandbox",
      value: { ...defaultSandboxConfig, bash_command_timeout: 1200 },
    });
    render(<SandboxSettings />);
    await waitFor(() => {
      expect(screen.getByText("沙箱配置")).toBeInTheDocument();
    });

    // 找到命令超时的 input（值 600）
    const inputs = screen.getAllByRole("spinbutton");
    const timeoutInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "600"
    ) as HTMLInputElement;
    fireEvent.change(timeoutInput, { target: { value: "1200" } });

    const saveBtns = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(mockRuntimeModule.updateRuntimeConfigSection).toHaveBeenCalledTimes(1);
    });
    const [, value] =
      mockRuntimeModule.updateRuntimeConfigSection.mock.calls[0];
    expect(value.bash_command_timeout).toBe(1200);
  });

  it("保存失败展示错误消息", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue({
      sandbox: defaultSandboxConfig,
    });
    mockRuntimeModule.updateRuntimeConfigSection.mockRejectedValue(
      new Error("写入 runtime.yaml 失败")
    );
    render(<SandboxSettings />);
    await waitFor(() => {
      expect(screen.getByText("沙箱配置")).toBeInTheDocument();
    });

    // 修改 Bash 输出上限
    const inputs = screen.getAllByRole("spinbutton");
    const bashOutputInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "20000"
    ) as HTMLInputElement;
    fireEvent.change(bashOutputInput, { target: { value: "30000" } });

    const saveBtns = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "写入 runtime.yaml 失败"
      );
    });
  });

  it("保存成功后展示 savedHint", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue({
      sandbox: defaultSandboxConfig,
    });
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "sandbox",
      value: defaultSandboxConfig,
    });
    render(<SandboxSettings />);
    await waitFor(() => {
      expect(screen.getByText("沙箱配置")).toBeInTheDocument();
    });

    // 修改 LS 输出上限
    const inputs = screen.getAllByRole("spinbutton");
    const lsOutputInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "20000" && i !== inputs.find(
        (j) => (j as HTMLInputElement).value === "20000"
      )
    );
    // 用最后那个 20000 值的 input（LS 输出上限）
    const last20000Input = inputs
      .filter((i) => (i as HTMLInputElement).value === "20000")
      .pop() as HTMLInputElement;
    fireEvent.change(last20000Input ?? lsOutputInput ?? inputs[inputs.length - 1], {
      target: { value: "25000" },
    });

    const saveBtns = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("保存"));
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(
        screen.getByText(/已写入 runtime\.yaml/)
      ).toBeInTheDocument();
    });
  });
});
