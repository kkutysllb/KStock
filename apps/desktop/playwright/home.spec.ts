import { expect, test } from "@playwright/test";

test("从入口页进入桌面工作台并打开设置", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "KStock" })).toBeVisible();
  await expect(page.getByText("QiLin 内置引擎")).toBeVisible();

  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("textbox", { name: "消息输入" })).toBeVisible();
  await expect(page.getByText("QiLin 已连接").first()).toBeVisible();

  await page.getByRole("button", { name: "打开设置" }).click();
  await page.getByRole("button", { name: "模型" }).click();
  await expect(page.locator('input[value="qilin.models.patched_deepseek:PatchedChatDeepSeek"]')).toBeVisible();
});
