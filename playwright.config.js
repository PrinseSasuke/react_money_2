const { defineConfig, devices } = require("@playwright/test");

// Порт dev-сервера для E2E: если 3000 занят чем-то посторонним (иначе
// reuseExistingServer молча прогонит тесты против чужого процесса).
const WEB_PORT = process.env.E2E_WEB_PORT || "3000";
const WEB_URL = `http://localhost:${WEB_PORT}`;

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: require.resolve("./e2e/global-setup.js"),
  // Full-page screenshots pick up a little font/animation rendering jitter
  // run to run even with nothing actually changed — allow a small tolerance
  // instead of chasing pixel-perfect determinism.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "Desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "Mobile",
      // Pixel 5 uses Chromium (not WebKit like the iPhone presets), so we
      // only need the one browser binary installed for both projects.
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: [
    {
      command: "node src/index.js",
      cwd: "./backend",
      url: "http://localhost:4001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        PORT: "4001",
        DB_HOST: "localhost",
        DB_PORT: "5433",
        DB_USER: "app",
        DB_PASSWORD: "app",
        DB_NAME: "react_money_test",
        JWT_SECRET: "test_secret_key_for_jest_do_not_use_in_prod",
      },
    },
    {
      command: "npm start",
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        PORT: WEB_PORT,
        REACT_APP_API_URL: "http://localhost:4001/api",
        BROWSER: "none",
      },
    },
  ],
});
