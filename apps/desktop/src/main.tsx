import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { isWindowsDesktop } from "./lib/desktopBridge";
import "./styles.css";

// Windows 无框窗口：渲染前先打平台类，各顶栏据此收回 macOS 红绿灯让位、
// 给右上角自绘窗控让位（styles.css 的 .os-windows 系列）。越早挂越能避免
// 首帧按 macOS 布局渲染再跳变。
if (isWindowsDesktop()) {
  document.documentElement.classList.add("os-windows");
  document.body.classList.add("os-windows");
}

// React mount 后移除 index.html 的加载占位（#boot-loader）。
// 若 JS 执行失败，占位保留，用户看到"正在加载…"而非黑屏。
const bootLoader = document.getElementById("boot-loader");
if (bootLoader) {
  bootLoader.classList.add("hidden");
  setTimeout(() => bootLoader.remove(), 300);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
