import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true
  },
  build: {
    // 单页应用主入口（Home.tsx + 全部组件）约 520 kB，超 Vite 默认 500 kB 阈值。
    // 桌面端从本地资源加载，体积不敏感，但按依赖拆 vendor chunk 仍有利于
    // 资源缓存与首屏解析；拆分后最大 chunk 约 200 kB，阈值放宽到 600 消除噪音。
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // markdown 生态（react-markdown + unified/remark/micromark 等）自成一组，
          // 其内部存在跨包引用，必须整体放同一 chunk；判断需先于 react 分组，
          // 避免 "react-markdown" 被 /react/ 误匹配。
          if (
            id.includes("react-markdown") ||
            id.includes("remark") ||
            id.includes("unified") ||
            id.includes("micromark") ||
            id.includes("mdast") ||
            id.includes("hast") ||
            id.includes("vfile") ||
            id.includes("unist") ||
            id.includes("trim-lines") ||
            id.includes("bail") ||
            id.includes("trough") ||
            id.includes("property-information") ||
            id.includes("comma-separated-tokens") ||
            id.includes("space-separated-tokens") ||
            id.includes("stringify-entities") ||
            id.includes("character-entities") ||
            id.includes("decode-named-character-reference") ||
            id.includes("web-namespaces") ||
            id.includes("html-void-elements") ||
            id.includes("ccount") ||
            id.includes("devlop") ||
            id.includes("extend") ||
            id.includes("zwitch") ||
            id.includes("is-plain-obj") ||
            // hast-util-to-jsx-runtime / mdast-util-to-markdown 的附属依赖，
            // 与 markdown 生态同组，避免 CJS 互操作产生跨 chunk 循环引用
            id.includes("style-to-object") ||
            id.includes("style-to-js") ||
            id.includes("inline-style-parser") ||
            id.includes("camelcase") ||
            id.includes("html-url-attributes") ||
            id.includes("estree-util-is-identifier-name") ||
            id.includes("escape-string-regexp") ||
            id.includes("longest-streak") ||
            id.includes("markdown-table") ||
            id.includes("@ungap/structured-clone")
          ) {
            return "markdown";
          }
          if (id.includes("@tauri-apps")) return "tauri";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) {
            return "react-vendor";
          }
          if (id.includes("lucide-react")) return "lucide";
          return "vendor";
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    globals: true,
    include: ["tests/**/*.spec.{ts,tsx}"],
    exclude: ["playwright/**"],
    // jsdom + React Testing Library 测试在 GitHub/macOS runner 与本地负载高时
    // 并行 worker 会互相抢 CPU，导致原本几百毫秒的设置页保存用例被拖到
    // 15s+ 超时。发布链路优先稳定，禁用文件并行并固定单 worker。
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15_000
  }
});
