import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

// Dedicated eval port, distinct from the e2e suite's 4399, so both can boot without colliding.
// workers: 1 so the self-throttle in agent.eval.ts paces requests sequentially.
// Uses `astro dev`: the Vercel adapter's SSR output can't be served by `astro preview`, so
// /api/chat would 404. (The e2e suite mocks /api/chat.)
const PORT = 4398;
const HOST = `http://localhost:${PORT}`;
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: '.',
  outputDir: `${REPO_ROOT}/test-results`,
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
    cwd: REPO_ROOT,
    command: `npm run dev -- --port ${PORT} --host`,
    url: HOST,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
