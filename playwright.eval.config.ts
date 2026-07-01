import { defineConfig } from '@playwright/test';

// Dedicated eval port, distinct from the e2e suite's 4399 — lets both
// suites boot their own preview server without colliding if run back to
// back. workers: 1 is required so the self-throttle in agent.eval.ts
// (which relies on tests running sequentially) actually paces requests.
const PORT = 4398;
const HOST = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/eval',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: HOST,
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --host`,
    url: HOST,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
