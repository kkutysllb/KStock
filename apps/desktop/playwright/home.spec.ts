import { expect, test } from "@playwright/test";

test("首屏展示桌面工作台", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("KStock")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "消息输入" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建会话" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "报告" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "技能" })).toBeVisible();
});
