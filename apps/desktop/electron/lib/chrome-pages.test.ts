import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { DARK_STATIC_ROUTES, PAGE_THEME_PREFIX, isDarkStaticRoute } from "./chrome-pages";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const pagesDir = join(repoRoot, "kstock", "web", "public");
const readPage = (file: string): string => readFileSync(join(pagesDir, file), "utf8");

/**
 * 登录页的白块事故（用户截图）：壳按 URL 判自有暗色页，而真实登录 URL 是引擎
 * 路由 /login?next=…，名单里只有 /kstock/kstock-auth.html，于是 overlay 一直用
 * 持久化（亮色）配色压在暗色画布上。这组契约把「页面自报」与「路由覆盖」两条
 * 判据钉住，任一侧漂移即失败。
 */
test("自有静态页自报暗色底色（壳消费同一前缀）", () => {
  for (const page of ["kstock-auth.html", "kstock-landing.html"]) {
    assert.match(readPage(page), new RegExp(`${PAGE_THEME_PREFIX}dark`), `${page} 应自报暗色`);
  }
});

test("暗色路由覆盖引擎的实际入口（登录/初始化/落地/直连文件）", () => {
  for (const path of [
    "/",
    "/login",
    "/setup",
    "/kstock/kstock-auth.html",
    "/kstock/kstock-landing.html",
  ]) {
    assert.ok(isDarkStaticRoute(`http://127.0.0.1:18001${path}`), `${path} 应判为暗色页`);
  }
  // 带查询串的登录入口（实测形态）也必须命中
  assert.ok(isDarkStaticRoute("http://127.0.0.1:18001/login?next=%2Fworkspace"));
});

test("引擎 UI 的亮暗由主题上报决定，不误判为静态页", () => {
  assert.equal(isDarkStaticRoute("http://127.0.0.1:18001/workspace"), false);
  // 解析失败的 URL 不应抛错
  assert.equal(isDarkStaticRoute("not a url"), false);
});

test("壳确实消费自报前缀（不是只定义不用）", () => {
  const source = readFileSync(join(repoRoot, "apps", "desktop", "electron", "lib", "chrome.ts"), "utf8");
  assert.match(source, /message\.startsWith\(PAGE_THEME_PREFIX\)/);
  // 自报分支不得落持久化：它只切当前窗口配色，用户偏好归引擎 UI 上报
  const reportBranch = source.slice(
    source.indexOf("message.startsWith(PAGE_THEME_PREFIX)"),
    source.indexOf("if (!message.startsWith(THEME_REPORT_PREFIX))"),
  );
  assert.doesNotMatch(reportBranch, /saveChromeTheme/);
});

test("路由名单常量化（改动必须过本测试，避免散落魔法字符串）", () => {
  assert.ok(DARK_STATIC_ROUTES.includes("/login"));
});
