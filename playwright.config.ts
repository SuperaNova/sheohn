import { defineConfig, devices } from '@playwright/test';

// Dedicated e2e port so the suite always boots a fresh dev server, never reusing one on 4321.
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
    // `astro preview` 404s every route under the @astrojs/vercel adapter, so serve its static
    // output; /api/chat is stubbed in-page, so no SSR is needed.
    command: `npm run build && node scripts/serve-static.mjs .vercel/output/static ${PORT}`,
    url: HOST,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
