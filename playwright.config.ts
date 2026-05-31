import { defineConfig, devices } from '@playwright/test';

// Dedicated e2e port so the suite always boots a fresh dev server on the
// current source — never reusing whatever happens to be on the normal dev
// port (4321). Isolated + deterministic locally and in CI.
const PORT = 4399;
const HOST = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: HOST,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --host`,
    url: HOST,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
