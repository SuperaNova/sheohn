import { defineConfig, devices } from '@playwright/test';

// Dedicated port, distinct from e2e (4399) and eval (4398), so the suites
// can run concurrently.
const PORT = 4397;
const HOST = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/visual',
  // No custom snapshotPathTemplate: Playwright's default already namespaces
  // snapshot filenames by {projectName} (and platform), so the desktop and
  // mobile projects below never collide on the same file, and a local
  // Windows smoke-run (see spec step 4) produces distinctly-suffixed files
  // from what the ubuntu CI job will produce — an extra guardrail against
  // ever accidentally committing a non-ubuntu baseline.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: HOST,
    // Pin timezone + locale so any locale/timezone-dependent rendering is
    // identical between a local (Windows, any TZ) smoke run and the CI
    // ubuntu runner. The header clock's displayed offset is already pinned
    // to personalInfo.timezone in product code; its variable wall-clock
    // instant is frozen separately in tests/visual/fixtures.ts.
    timezoneId: 'Asia/Manila',
    locale: 'en-US',
  },
  // Snapshots are generated and compared ONLY in CI (ubuntu) — see
  // .github/workflows/visual.yml. A small non-zero tolerance absorbs
  // sub-pixel anti-aliasing noise without masking real regressions.
  // `animations: 'disabled'` freezes CSS animations/transitions (including
  // the Svelte fly-transition's runtime-generated @keyframes animation) at
  // their final state — used alongside each test's `emulateMedia({
  // reducedMotion: 'reduce' })` for belt-and-suspenders determinism.
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
    // NOT the e2e suite's build+preview pattern (playwright.config.ts):
    // verified locally that `astro preview` 404s every route under this
    // project's @astrojs/vercel adapter (prerendered pages land in
    // dist/client/, not the flat dist/ layout `astro preview` expects — it
    // isn't adapter-aware). Lighthouse CI already works around this same
    // issue by pointing its own static server at `.vercel/output/static`
    // (see lighthouserc.json's `staticDistDir`) instead of using `astro
    // preview` — scripts/serve-static.mjs does the same for Playwright.
    // This suite never touches /api/chat, so the `astro dev` workaround
    // playwright.eval.config.ts needed for SSR routes doesn't apply here;
    // production-representative static rendering is exactly what a
    // visual-regression suite wants.
    command: `npm run build && node scripts/serve-static.mjs .vercel/output/static ${PORT}`,
    url: HOST,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
