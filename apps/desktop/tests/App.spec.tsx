import { render, screen } from "@testing-library/react";
import { App } from "../src/App";

test("首屏展示聊天工作台", () => {
  render(<App />);

  expect(screen.getByText("KStock")).toBeVisible();
  expect(screen.getByRole("textbox", { name: "消息输入" })).toBeVisible();
  expect(screen.getByRole("button", { name: "新建会话" })).toBeVisible();
  expect(screen.getByText("报告")).toBeVisible();
  expect(screen.getByText("技能")).toBeVisible();
});
