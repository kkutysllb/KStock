import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { App } from "../src/App";
import { createModel, listModels } from "../src/lib/modelsClient";

// 用 hoisted 持有 mock 函数，便于在单个测试内覆盖返回值（如模拟已登录）。
const authMock = vi.hoisted(() => ({
  tryGetCurrentUser: vi.fn(),
}));

// turnsClient mock：streamRun 的实现由各测试用 mockImplementation 覆盖。
const turnsMock = vi.hoisted(() => ({
  ensureThread: vi.fn(),
  streamRun: vi.fn(),
}));

// gatewayControl mock：restartGateway / waitForGateway 由各测试覆盖返回值。
const controlMock = vi.hoisted(() => ({
  restartGateway: vi.fn(),
  waitForGateway: vi.fn(),
}));

// 会话探测与认证请求统一 mock：jsdom 无法直连本地 gateway，且测试只关心 UI 流程。
vi.mock("../src/lib/authClient", () => ({
  GATEWAY_URL: "http://localhost:18001",
  tryGetCurrentUser: authMock.tryGetCurrentUser,
  getSetupStatus: vi.fn().mockResolvedValue({ needs_setup: false, registration_enabled: true }),
  login: vi.fn().mockResolvedValue({ expires_in: 604800, needs_setup: false }),
  register: vi.fn(),
  initializeAdmin: vi.fn(),
  logout: vi.fn().mockResolvedValue({ message: "logout ok" }),
  isAuthApiError: (e: unknown) =>
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    "message" in e &&
    "status" in e,
}));

// 模型配置 API mock：listModels 默认返回空列表（无已配置模型）。
vi.mock("../src/lib/modelsClient", () => ({
  listModels: vi.fn().mockResolvedValue({ models: [], default_model: null }),
  createModel: vi.fn(),
  updateModel: vi.fn(),
  deleteModel: vi.fn(),
  getDefaultModel: vi.fn().mockResolvedValue({ default_model: null }),
  setDefaultModel: vi.fn().mockResolvedValue({ default_model: null }),
  isModelsApiError: (e: unknown) =>
    typeof e === "object" && e !== null && "message" in e && "status" in e,
}));

// turnsClient mock：ensureThread 默认返回固定 thread_id；streamRun 默认空实现（各测试覆盖）。
// listThreads 默认返回空数组（无历史会话）；deleteThread 默认成功；cancelRun 默认成功。
vi.mock("../src/lib/turnsClient", () => ({
  ensureThread: turnsMock.ensureThread,
  streamRun: turnsMock.streamRun,
  runContextFromModel: () => ({
    model_name: "test-model",
    thinking_enabled: false,
  }),
  fetchThreadMessages: vi.fn(),
  listThreads: vi.fn().mockResolvedValue([]),
  deleteThread: vi.fn().mockResolvedValue(undefined),
  cancelRun: vi.fn().mockResolvedValue(undefined),
}));

// gatewayControlClient mock：重启后端的 restart + 健康轮询由各测试覆盖。
vi.mock("../src/lib/gatewayControlClient", () => ({
  restartGateway: controlMock.restartGateway,
  waitForGateway: controlMock.waitForGateway,
  isGatewayControlApiError: (e: unknown) =>
    typeof e === "object" && e !== null && "message" in e && "status" in e,
}));

// 默认未登录；已登录场景在测试内用 mockResolvedValueOnce 覆盖。
beforeEach(() => {
  authMock.tryGetCurrentUser.mockResolvedValue(null);
  turnsMock.ensureThread.mockResolvedValue("thread-test");
  turnsMock.streamRun.mockReset();
  controlMock.restartGateway.mockReset();
  controlMock.waitForGateway.mockReset();
});

test("首屏展示产品入口页", async () => {
  render(<App />);

  // 会话探测异步完成后落地页才出现“进入工作台”按钮。
  const enterButton = await screen.findByRole("button", { name: "进入工作台" });
  expect(enterButton).toBeVisible();
  expect(screen.getByText("QiLin 内置引擎")).toBeInTheDocument();
});

test("已登录启动后直接进入工作台并打开设置模型页", async () => {
  // 模拟已登录：启动会话探测后自动跳转工作台，不再停在落地页。
  authMock.tryGetCurrentUser.mockResolvedValueOnce({
    id: "u1",
    email: "tester@kstock.dev",
    system_role: "user",
  });

  render(<App />);

  // 已登录用户直接看到工作台的输入区与设置入口。
  expect(await screen.findByRole("textbox", { name: "消息输入" })).toBeVisible();
  expect(screen.getByRole("button", { name: "打开设置" })).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "打开设置" }));
  fireEvent.click(screen.getByRole("button", { name: "模型" }));

  expect(screen.getByRole("heading", { name: "模型" })).toBeVisible();
  // 新 CRUD UI：无已配置模型时显示空状态提示与添加按钮。
  expect(await screen.findByText("尚未配置任何模型。点击「添加模型」，从模板创建或自定义一个。")).toBeVisible();
  expect(screen.getByRole("button", { name: "+ 添加模型" })).toBeVisible();
});

test("注册入口展示邮箱密码与确认密码表单", async () => {
  render(<App />);

  await screen.findByRole("button", { name: "进入工作台" });
  fireEvent.click(screen.getByRole("button", { name: "注册" }));

  expect(screen.getByPlaceholderText("research@kstock.dev")).toBeVisible();
  expect(screen.getByPlaceholderText("至少 8 位")).toBeVisible();
  expect(screen.getByPlaceholderText("再次输入密码")).toBeVisible();
  expect(screen.getByRole("button", { name: "注册并进入" })).toBeVisible();
  expect(screen.getByLabelText(/记住我/)).toBeChecked();
});

test("未登录点“进入工作台”跳转到登录页", async () => {
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "进入工作台" }));

  expect(await screen.findByRole("heading", { name: "登录工作台" })).toBeVisible();
  expect(screen.getByRole("button", { name: "登录并进入" })).toBeVisible();
});

test("无模型时输入框选择器显示未配置且发送禁用", async () => {
  authMock.tryGetCurrentUser.mockResolvedValueOnce({
    id: "u1", email: "t@k.dev", system_role: "user",
  });
  render(<App />);

  expect(await screen.findByRole("textbox", { name: "消息输入" })).toBeVisible();
  expect(screen.getByText("未配置模型（请到设置页添加）")).toBeVisible();
  expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
});

test("设置页添加模型后输入框选择器同步刷新（不重启）", async () => {
  // 场景：登录后 listModels 初次返回空（未配置），进设置页添加模型后
  // ModelSettings.reload 再次调 listModels 返回新列表，onModelsChanged
  // 回调把数据同步到 Home 的 models state，输入框选择器立即刷新。
  authMock.tryGetCurrentUser.mockResolvedValueOnce({
    id: "u1", email: "t@k.dev", system_role: "user",
  });
  vi.mocked(listModels)
    // Home 启动加载（未配置）
    .mockResolvedValueOnce({ models: [], default_model: null })
    // ModelSettings 首次 reload（进设置页，未配置）
    .mockResolvedValueOnce({ models: [], default_model: null })
    // ModelSettings 添加模型后 reload（有 1 个模型）
    .mockResolvedValueOnce({
      models: [{
        name: "deepseek",
        display_name: "DeepSeek V4",
        description: null,
        use: "qilin.models.patched_deepseek:PatchedChatDeepSeek",
        model: "deepseek-v4",
        api_base: "https://api.deepseek.com",
        api_key_env: "$KSTOCK_MODEL_DEEPSEEK_KEY",
        supports_thinking: false,
        supports_vision: false,
        supports_reasoning_effort: false,
      }],
      default_model: null,
    });
  vi.mocked(createModel).mockResolvedValueOnce({
    name: "deepseek",
    display_name: "DeepSeek V4",
    description: null,
    use: "qilin.models.patched_deepseek:PatchedChatDeepSeek",
    model: "deepseek-v4",
    api_base: "https://api.deepseek.com",
    api_key_env: "$KSTOCK_MODEL_DEEPSEEK_KEY",
    supports_thinking: false,
    supports_vision: false,
    supports_reasoning_effort: false,
  });

  render(<App />);

  expect(await screen.findByRole("textbox", { name: "消息输入" })).toBeVisible();
  // 初始：未配置模型
  expect(screen.getByText("未配置模型（请到设置页添加）")).toBeVisible();

  // 进设置页 → 模型
  fireEvent.click(screen.getByRole("button", { name: "打开设置" }));
  fireEvent.click(screen.getByRole("button", { name: "模型" }));
  expect(await screen.findByText(/尚未配置任何模型/)).toBeVisible();

  // 添加模型：点「+ 添加模型」 → 选空白自定义 → 等表单出现 → 填表 → 提交
  fireEvent.click(screen.getByRole("button", { name: "+ 添加模型" }));
  fireEvent.click(screen.getByRole("button", { name: /空白自定义/ }));
  // 等表单出现（initialTemplate 非空后才渲染表单字段）
  const nameInput = await screen.findByLabelText(/name（唯一标识）/);
  fireEvent.change(nameInput, { target: { value: "deepseek" } });
  fireEvent.change(screen.getByLabelText(/display_name/), { target: { value: "DeepSeek V4" } });
  fireEvent.click(screen.getByRole("button", { name: "创建" }));

  // 回到工作台（返回应用）
  fireEvent.click(screen.getByRole("button", { name: "返回应用" }));

  // 输入框选择器现在显示新模型（不再显示「未配置」）
  const select = await screen.findByRole("combobox");
  expect(select).toBeVisible();
  expect(screen.queryByText("未配置模型（请到设置页添加）")).toBeNull();
  expect((select as HTMLSelectElement).value).toBe("deepseek");
});

test("发消息触发流式 run 并逐帧累积 assistant 文本", async () => {
  authMock.tryGetCurrentUser.mockResolvedValueOnce({
    id: "u1", email: "t@k.dev", system_role: "user",
  });
  vi.mocked(listModels).mockResolvedValueOnce({
    models: [{
      name: "test-model",
      display_name: "Test",
      use: "openai",
      model: "gpt-4",
      supports_thinking: false,
      supports_vision: false,
    }],
    default_model: "test-model",
  });
  turnsMock.streamRun.mockImplementation(async (opts) => {
    opts.handlers.onFrame({ event: "messages", data: [{ type: "ai", content: "你好", id: "m1" }, {}] });
    opts.handlers.onFrame({ event: "messages", data: [{ type: "ai", content: "，世界", id: "m1" }, {}] });
    opts.handlers.onFrame({ event: "end", data: null });
  });

  render(<App />);

  const textarea = await screen.findByRole("textbox", { name: "消息输入" });
  // 等待模型列表加载完成（select 出现 = models 非空，发送按钮 enabled）
  await screen.findByRole("combobox");
  fireEvent.change(textarea, { target: { value: "分析茅台" } });
  fireEvent.click(screen.getByRole("button", { name: "发送消息" }));

  // user message 渲染（在 UserBubble 的 <p> 中；session title/topbar 也有同文本需 selector 精确定位）
  expect(await screen.findByText("分析茅台", { selector: "p" })).toBeVisible();
  // assistant 流式文本累积（"你好" + "，世界"）
  expect(await screen.findByText(/你好.*世界/)).toBeVisible();
  // ensureThread 被调用
  expect(turnsMock.ensureThread).toHaveBeenCalledTimes(1);
  // streamRun 被调用，参数包含正确的 threadId 与 input
  expect(turnsMock.streamRun).toHaveBeenCalledTimes(1);
  const runOpts = turnsMock.streamRun.mock.calls[0][0];
  expect(runOpts.threadId).toBe("thread-test");
  expect(runOpts.input.messages[0].content).toBe("分析茅台");
});

test("设置页重启后端：点按钮弹 ConfirmDialog，确认后触发 restart", async () => {
  authMock.tryGetCurrentUser.mockResolvedValueOnce({
    id: "u1", email: "t@k.dev", system_role: "user",
  });
  controlMock.restartGateway.mockResolvedValueOnce({ message: "ok", supervised: true });
  controlMock.waitForGateway.mockResolvedValueOnce(true);

  render(<App />);

  await screen.findByRole("textbox", { name: "消息输入" });
  fireEvent.click(screen.getByRole("button", { name: "打开设置" }));

  // 点「重启后端」按钮 → 弹出 ConfirmDialog（不是原生 window.confirm）
  const restartBtn = screen.getByRole("button", { name: "重启后端" });
  expect(restartBtn).toBeEnabled();
  fireEvent.click(restartBtn);

  // ConfirmDialog 出现，包含标题与描述
  expect(await screen.findByRole("heading", { name: "重启后端" })).toBeVisible();
  expect(screen.getByText(/约 2-3 秒恢复/)).toBeVisible();
  // 此时 restart 尚未被调用（等用户点「确认重启」）
  expect(controlMock.restartGateway).not.toHaveBeenCalled();

  // 点「确认重启」→ 触发真正的重启流程
  fireEvent.click(screen.getByRole("button", { name: "确认重启" }));

  // restart + waitForGateway 依次被调用
  await waitFor(() => expect(controlMock.restartGateway).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(controlMock.waitForGateway).toHaveBeenCalledTimes(1));

  // 成功状态提示
  expect(await screen.findByText("后端已恢复。")).toBeVisible();
});
