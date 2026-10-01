import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true });

export default defineConfig({
  testDir: "./frontend/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    timezoneId: "Africa/Casablanca",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev --workspace backend",
      url: "http://localhost:4000/health/ready",
      reuseExistingServer: true,
      timeout: 30_000
    },
    {
      command: "npm run dev --workspace frontend -- --host 127.0.0.1",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 30_000
    }
  ]
});
