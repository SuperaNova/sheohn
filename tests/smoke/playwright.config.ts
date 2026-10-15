import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const baseURL = process.env.SMOKE_BASE_URL ?? 'https://www.sheohn.dev';

// No webServer: the suite targets an already-deployed URL.
export default defineConfig({
  testDir: '.',
  outputDir: `${REPO_ROOT}/test-results`,
  testMatch: '**/*.smoke.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 45_000,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
