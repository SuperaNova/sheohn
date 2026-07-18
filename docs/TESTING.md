# Testing Guide

This repository is configured with a comprehensive testing suite to ensure the stability, accessibility, and visual integrity of the application.

## 1. Unit & Component Testing (Vitest)

We use **Vitest** along with the **Svelte Testing Library** to test individual components and isolated utility functions.

- **Run unit tests:**
  ```bash
  npm run test:unit
  ```
- **Where to put tests:** Place your `.spec.ts` or `.test.ts` files in the `src/` directory, usually right next to the component they are testing (e.g., `src/components/ThemeToggle.spec.ts`).

## 2. End-to-End (E2E) Testing (Playwright)

We use **Playwright** to test full user flows in the browser exactly as a real user would experience them. This suite also runs accessibility scans inline (below); visual regression is a separate suite (§3).

- **Run E2E tests:**
  ```bash
  npm run test:e2e
  ```
- **Run in UI Mode (Recommended):** Opens a visual interface to debug and trace tests step-by-step.
  ```bash
  npm run test:e2e:ui
  ```
- **Where to put tests:** Place your E2E tests in the `tests/e2e/` directory.

### Accessibility Testing (Axe)

Playwright is configured with `@axe-core/playwright` to automatically scan pages for accessibility violations (like missing alt text, poor contrast, or incorrect ARIA roles).

_Example usage in a test:_

```typescript
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);
```

## 3. Visual Regression Testing

Visual regression is a **separate suite**, not part of `npm run test:e2e`. It lives in `tests/visual/` with its own config (`playwright.visual.config.ts`) and its own workflow (`.github/workflows/visual.yml`).

- **Run it locally (compare only, no writes):**
  ```bash
  npx playwright test --config=playwright.visual.config.ts
  ```
- **Baselines are generated ONLY on ubuntu CI.** Font rendering and anti-aliasing differ across OSes, so a baseline generated on Windows or macOS will not match what CI produces and must never be committed. To refresh baselines:
  1. Run the `visual.yml` workflow manually (`workflow_dispatch`) on GitHub.
  2. Its `update-snapshots` job regenerates screenshots on ubuntu and uploads them as a build artifact (`visual-baseline-snapshots`) — it does not commit anything itself.
  3. Download the artifact, review the images by hand, and commit `tests/visual/**/*-snapshots/**` yourself.
- Do **not** run `--update-snapshots` locally — it silently writes win32/macOS-suffixed baseline files that CI will reject as mismatches.
- Baseline images live alongside their spec, e.g. `tests/visual/deck.visual.spec.ts-snapshots/` and `tests/visual/pages.visual.spec.ts-snapshots/`, and are committed to version control. `playwright-report/` and `test-results/` are gitignored.

## 4. The Eval Harness (Playwright vs. a live Gemini)

`npm run eval:agent` runs `tests/eval/agent.eval.ts` against `playwright.eval.config.ts`, which boots `astro dev` (not build+preview — the SSR `/api/chat` route needs a real dev server) and drives the Command Deck against a **live** Gemini + Upstash Vector backend. It needs real credentials (`GOOGLE_GENERATIVE_AI_API_KEY`, `UPSTASH_VECTOR_REST_*`), so it's manual-only locally and runs weekly in CI (`.github/workflows/eval.yml`, Monday 06:00 UTC, plus `workflow_dispatch`). Each case in `tests/eval/cases.ts` checks the agent's tool-calling and RAG grounding — e.g. that a background question triggers `query_jared_memory` and the reply cites a retrieved fact. Results feed `data/eval-history/` (see the eval pass-rate badge in the README) and a regression flags an open GitHub issue via `scripts/check-eval-regression.ts`.

## 5. Mutation Testing (Stryker)

`npm run mutation` runs Stryker over `src/lib` + `src/data` (see `stryker.config.json`), mutating logic and re-running the unit suite to check it actually catches the mutation. It's slow, so it isn't a PR gate — it runs weekly (`.github/workflows/mutation.yml`, Monday 08:00 UTC, plus `workflow_dispatch`) and the score feeds `data/mutation-score.json` (the mutation-score badge in the README) via `scripts/mutation-summary.ts`.

## 6. Performance & SEO Testing (Lighthouse CI)

We run **Lighthouse** automatically against the production build to ensure performance, accessibility, best practices, and SEO scores stay high.

- **Run Lighthouse locally:**
  ```bash
  npm run lighthouse:local
  ```

This command will:

1. Build the Astro project for production.
2. Run `lhci autorun` to collect metrics across light/dark themes and multiple pages.
3. Automatically execute `scripts/lh-summary.mjs` to dump a clean, color-coded table of scores directly into your terminal.

If you ever need to debug a failing score, the raw HTML reports are saved locally in the `.lighthouseci/` directory (which is ignored by version control).
