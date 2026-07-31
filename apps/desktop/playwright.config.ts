import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",
  use: {
    baseURL: "http://127.0.0.1:1420",
    trace: "on-first-retry"
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
