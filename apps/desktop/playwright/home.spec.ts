import { expect, test } from "@playwright/test";

test("未登录从入口页进入工作台时展示登录页", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "KStock" })).toBeVisible();
  await expect(page.getByText("QiLin 内置引擎")).toBeVisible();

  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { name: "登录工作台" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登录并进入" })).toBeVisible();
});
