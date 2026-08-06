import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

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
