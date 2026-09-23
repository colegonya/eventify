import { defineConfig, devices } from "@playwright/test";
import { AUTH_STATE_PATH, E2E_BASE_URL, E2E_PORT, E2E_SERVER_ENV } from "./e2e/env.mjs";

const CI = Boolean(process.env.CI);

// Lets a machine with its own Chromium build use it instead of Playwright's
// download. Unset everywhere else.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.mjs",
  // One shared database, so one test at a time. The suite is small; parallel
  // tests racing on the same Redis is the usual source of flaky failures.
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: "setup",
      testMatch: /first-run\.setup\.mjs/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "desktop",
      dependencies: ["setup"],
      testIgnore: /mobile\.spec\.mjs/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: AUTH_STATE_PATH,
      },
    },
    {
      name: "phone",
      dependencies: ["setup"],
      testMatch: /mobile\.spec\.mjs/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        storageState: AUTH_STATE_PATH,
      },
    },
  ],
  // A production build, not `next dev`: several bugs only show in production,
  // where Next.js strips error messages and serves the optimized bundles.
  webServer: {
    command: `npx next build && npx next start -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/login`,
    env: E2E_SERVER_ENV,
    timeout: 240_000,
    reuseExistingServer: !CI,
  },
});
