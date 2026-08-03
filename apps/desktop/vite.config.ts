import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true
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
