import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

import { GuardrailsSettings } from "../src/components/GuardrailsSettings";

// ── 固定数据 ──

const guardrailsConfig = {
  enabled: false,
  fail_closed: true,
  passport: null,
  provider: null,
};

const authorizationConfig = {
  enabled: false,
  fail_closed: true,
  default_role: "user",
  provider: null,
};

const inputPolishConfig = {
  enabled: true,
  max_chars: 4000,
  model_name: null,
};

const loopDetectionConfig = {
  enabled: true,
  warn_threshold: 3,
  hard_limit: 5,
  window_size: 20,
  max_tracked_threads: 100,
  tool_freq_warn: 30,
  tool_freq_hard_limit: 50,
  tool_freq_overrides: {},
};

const safetyFinishConfig = {
  enabled: true,
  detectors: null,
};

const fullConfig = {
  guardrails: guardrailsConfig,
  authorization: authorizationConfig,
  input_polish: inputPolishConfig,
  loop_detection: loopDetectionConfig,
  safety_finish_reason: safetyFinishConfig,
};

async function clickEnabledSaveButtonInCard(title: string) {
  const card = screen.getByLabelText(title);
  const saveButton = within(card).getByRole("button", { name: /保存/ });
  await waitFor(() => {
    expect(saveButton).not.toBeDisabled();
  });
  await act(async () => {
    fireEvent.click(saveButton);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 加载与展示 ───────────────────────────────────────────────────────

describe("GuardrailsSettings 加载与展示", () => {
  it("加载配置后展示注意事项 + 五张卡片", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue(fullConfig);
    render(<GuardrailsSettings />);
    await waitFor(() => {
      expect(screen.getByText("护栏中间件")).toBeInTheDocument();
    });
    expect(screen.getByText("资源授权")).toBeInTheDocument();
    expect(screen.getByText("输入清洗")).toBeInTheDocument();
    expect(screen.getByText("循环检测")).toBeInTheDocument();
    expect(screen.getByText("安全 finish_reason 拦截")).toBeInTheDocument();
    expect(screen.getByText(/护栏配置需重启 gateway 生效/)).toBeInTheDocument();
  });

  it("加载时展示 loading 占位", () => {
    mockRuntimeModule.getRuntimeConfig.mockReturnValue(new Promise(() => {}));
    render(<GuardrailsSettings />);
    expect(screen.getByText("加载护栏配置…")).toBeInTheDocument();
  });

  it("加载失败展示错误消息", async () => {
    mockRuntimeModule.getRuntimeConfig.mockRejectedValue({
      message: "引擎未启动",
      status: 0,
    });
    render(<GuardrailsSettings />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("引擎未启动");
    });
  });
});

// ── 编辑与保存 ──────────────────────────────────────────────────────

describe("GuardrailsSettings 编辑与保存", () => {
  it("启用护栏开关后保存调用 PUT guardrails", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue(fullConfig);
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "guardrails",
      value: { ...guardrailsConfig, enabled: true },
    });
    render(<GuardrailsSettings />);
    await waitFor(() => {
      expect(screen.getByText("护栏中间件")).toBeInTheDocument();
    });

    const guardrailsCard = screen.getByLabelText("护栏中间件");
    fireEvent.click(within(guardrailsCard).getAllByRole("checkbox")[0]);
    await clickEnabledSaveButtonInCard("护栏中间件");

    await waitFor(() => {
      expect(mockRuntimeModule.updateRuntimeConfigSection).toHaveBeenCalledTimes(1);
    });
    const [section, value] = mockRuntimeModule.updateRuntimeConfigSection.mock.calls[0];
    expect(section).toBe("guardrails");
    expect(value.enabled).toBe(true);
  });

  it("修改 default_role 后保存调用 PUT authorization", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue(fullConfig);
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "authorization",
      value: { ...authorizationConfig, default_role: "admin" },
    });
    render(<GuardrailsSettings />);
    await waitFor(() => {
      expect(screen.getByText("资源授权")).toBeInTheDocument();
    });

    // 修改默认角色 input
    const roleInput = screen.getByDisplayValue("user") as HTMLInputElement;
    fireEvent.change(roleInput, { target: { value: "admin" } });

    await clickEnabledSaveButtonInCard("资源授权");

    await waitFor(() => {
      expect(mockRuntimeModule.updateRuntimeConfigSection).toHaveBeenCalledTimes(1);
    });
    const [section, value] = mockRuntimeModule.updateRuntimeConfigSection.mock.calls[0];
    expect(section).toBe("authorization");
    expect(value.default_role).toBe("admin");
  });

  it("修改循环检测告警阈值后保存调用 PUT loop_detection", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue(fullConfig);
    mockRuntimeModule.updateRuntimeConfigSection.mockResolvedValue({
      section: "loop_detection",
      value: { ...loopDetectionConfig, warn_threshold: 5 },
    });
    render(<GuardrailsSettings />);
    await waitFor(() => {
      expect(screen.getByText("循环检测")).toBeInTheDocument();
    });

    // 找到值 3 的 input（warn_threshold）
    const inputs = screen.getAllByRole("spinbutton");
    const warnInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "3"
    ) as HTMLInputElement;
    fireEvent.change(warnInput, { target: { value: "5" } });

    await clickEnabledSaveButtonInCard("循环检测");

    await waitFor(() => {
      expect(mockRuntimeModule.updateRuntimeConfigSection).toHaveBeenCalledTimes(1);
    });
    const [section, value] = mockRuntimeModule.updateRuntimeConfigSection.mock.calls[0];
    expect(section).toBe("loop_detection");
    expect(value.warn_threshold).toBe(5);
  });

  it("保存失败展示错误消息", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue(fullConfig);
    mockRuntimeModule.updateRuntimeConfigSection.mockRejectedValue(
      new Error("写入 runtime.yaml 失败")
    );
    render(<GuardrailsSettings />);
    await waitFor(() => {
      expect(screen.getByText("护栏中间件")).toBeInTheDocument();
    });

    const guardrailsCard = screen.getByLabelText("护栏中间件");
    fireEvent.click(within(guardrailsCard).getAllByRole("checkbox")[0]);
    await clickEnabledSaveButtonInCard("护栏中间件");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("写入 runtime.yaml 失败");
    });
  });
});

// ── authorization.enabled 依赖 provider 的联动 ───────────────────

describe("GuardrailsSettings authorization provider 联动", () => {
  it("provider 为 null 时“启用资源授权”开关禁用 + 显示警告提示", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue(fullConfig);
    render(<GuardrailsSettings />);
    await waitFor(() => {
      expect(screen.getByText("资源授权")).toBeInTheDocument();
    });

    // 资源授权卡是第二张卡，里面的第一个 checkbox 是“启用资源授权”
    // （第二个是 fail_closed，不在 provider 依赖链上）
    const authzCard = screen.getAllByLabelText("资源授权")[0];
    const enabledCheckbox = within(authzCard).getAllByRole("checkbox")[0];
    expect(enabledCheckbox).toBeDisabled();

    // 卡片描述提示未配置 provider
    expect(screen.getByText(/当前未配置 provider/)).toBeInTheDocument();
    // 字段下方的警告提示
    expect(screen.getByText(/需先在 runtime.yaml 配置 authorization.provider.use/)).toBeInTheDocument();
  });

  it("provider 已配置时“启用资源授权”开关可用", async () => {
    mockRuntimeModule.getRuntimeConfig.mockResolvedValue({
      ...fullConfig,
      authorization: {
        ...authorizationConfig,
        provider: {
          use: "qilin.authz.rbac:RbacAuthorizationProvider",
          config: { roles: { user: { tools: { allow: "*" } } } },
        },
      },
    });
    render(<GuardrailsSettings />);
    await waitFor(() => {
      expect(screen.getByText("资源授权")).toBeInTheDocument();
    });

    const authzCard = screen.getAllByLabelText("资源授权")[0];
    const enabledCheckbox = within(authzCard).getAllByRole("checkbox")[0];
    expect(enabledCheckbox).not.toBeDisabled();

    // 未配置 provider 的警告提示不应出现
    expect(screen.queryByText(/当前未配置 provider/)).not.toBeInTheDocument();
  });
});
