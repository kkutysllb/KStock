import { fireEvent, render, screen } from "@testing-library/react";
import { App } from "../src/App";

test("首屏展示产品入口页", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "KStock" })).toBeVisible();
  expect(screen.getByText("QiLin 内置引擎")).toBeVisible();
  expect(screen.getByRole("button", { name: "进入工作台" })).toBeVisible();
  expect(screen.getByRole("button", { name: "注册" })).toBeVisible();
});

test("可以进入工作台并打开设置模型页", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "进入工作台" }));
  expect(screen.getByRole("textbox", { name: "消息输入" })).toBeVisible();
  expect(screen.getByRole("button", { name: "打开设置" })).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "打开设置" }));
  fireEvent.click(screen.getByRole("button", { name: "模型" }));

  expect(screen.getByRole("heading", { name: "模型" })).toBeVisible();
  expect(screen.getByDisplayValue("qilin.models.patched_deepseek:PatchedChatDeepSeek")).toBeVisible();
  expect(screen.getByText("qilin.models.patched_openai:PatchedChatOpenAI")).toBeVisible();
});
