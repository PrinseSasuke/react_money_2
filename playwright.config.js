const { defineConfig, devices } = require("@playwright/test");

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
    baseURL: "http://localhost:3000",
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
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        REACT_APP_API_URL: "http://localhost:4001/api",
        BROWSER: "none",
      },
    },
  ],
});
