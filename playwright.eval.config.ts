import { defineConfig } from '@playwright/test';

// Dedicated eval port, distinct from the e2e suite's 4399 — lets both
// suites boot their own dev server without colliding if run back to back.
// workers: 1 is required so the self-throttle in agent.eval.ts (which
// relies on tests running sequentially) actually paces requests.
//
// Uses `astro dev`, not `astro build && astro preview` (unlike the e2e
// suite's playwright.config.ts): this project's Vercel adapter writes SSR
// output to `.vercel/output/functions` in a format `astro preview` cannot
// serve, so /api/chat 404s under `astro preview`. `astro dev` always runs
// SSR/API routes directly via Vite regardless of adapter, so it's the only
// option that actually serves a live /api/chat locally. The e2e suite
// never needed this because it mocks /api/chat instead of calling it.
const PORT = 4398;
const HOST = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/eval',
  // Default testMatch (**/*.@(spec|test).?(c|m)[jt]s?(x)) requires ".spec."
  // or ".test." in the filename — agent.eval.ts doesn't match, so tests
  // would silently be discovered as "0 tests" without this override.
  testMatch: '**/*.eval.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: HOST,
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --host`,
    url: HOST,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
