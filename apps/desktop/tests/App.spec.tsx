import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { App } from "../src/App";

// 用 hoisted 持有 mock 函数，便于在单个测试内覆盖返回值（如模拟已登录）。
const authMock = vi.hoisted(() => ({
  tryGetCurrentUser: vi.fn(),
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

// 默认未登录；已登录场景在测试内用 mockResolvedValueOnce 覆盖。
beforeEach(() => {
  authMock.tryGetCurrentUser.mockResolvedValue(null);
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
