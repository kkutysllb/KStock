import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom 的 localStorage / sessionStorage 跨测试会残留（同 origin），
// Home.tsx 大量用 localStorage 持久化（sessions / activeModel /
// reasoningMode 等），上一个测试写入的状态会污染下一个测试的初始渲染，
// 在 CI 高负载下引发 flaky（曾导致 App.spec “桌面系统菜单事件可新建任务”
// 在 v0.1.4 ubuntu CI 反复失败）。每个测试后强制清空。
afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
