import { defineConfig, devices } from '@playwright/test';

// Dedicated port (e2e uses 4399, eval 4398) so suites can run concurrently.
const PORT = 4397;
const HOST = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/visual',
  // Default snapshotPathTemplate already namespaces by project and platform, so a non-ubuntu
  // local run can't be mistaken for a CI baseline.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: HOST,
    // Pin timezone and locale for parity between local runs and the CI runner; the header clock's
    // wall-clock instant is frozen in tests/visual/fixtures.ts.
    timezoneId: 'Asia/Manila',
    locale: 'en-US',
  },
  // Snapshots are generated and compared only in CI (ubuntu). A small tolerance absorbs
  // anti-aliasing noise; `animations: 'disabled'` freezes CSS animations at their final state.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    // Serves the static build via scripts/serve-static.mjs: `astro preview` 404s every route with
    // the @astrojs/vercel adapter. This suite never hits /api/chat, so static rendering suffices.
    command: `npm run build && node scripts/serve-static.mjs .vercel/output/static ${PORT}`,
    url: HOST,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
