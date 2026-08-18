import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

/**
 * Shared fixture for the visual suite; import `test`/`expect` from here
 * (kept independent of tests/e2e/fixtures.ts). Emulates reduced motion so
 * animations settle before screenshots, pre-seeds the Loader's
 * sessionStorage flag, and freezes `Date` so the header's live clock can't
 * diff between runs.
 */

// 2026-01-01T04:00:00Z — renders as "12:00 (UTC+08:00)" in the header's
// Asia/Manila clock. Arbitrary but fixed; keep as-is or all baselines with a
// visible clock must be regenerated.
const FROZEN_EPOCH_MS = Date.UTC(2026, 0, 1, 4, 0, 0);

// Raw string, NOT a function: Playwright's transpiler rewrites TS class
// syntax using module-scope helpers that don't exist in-page, so a
// function-form init script throws silently and the freeze never applies.
const FREEZE_DATE_SCRIPT = `(() => {
  const frozenNow = ${FROZEN_EPOCH_MS};
  const OriginalDate = Date;
  class FrozenDate extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(frozenNow);
      } else {
        super(...args);
      }
    }
    static now() {
      return frozenNow;
    }
  }
  window.Date = FrozenDate;
})();`;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('loader-played', 'true');
      } catch {
        /* sessionStorage may be unavailable pre-navigation; ignore */
      }
    });
    await page.addInitScript(FREEZE_DATE_SCRIPT);
    await use(page);
  },
});

export { expect };

/**
 * Pre-seeds localStorage's 'theme' key to match the `?theme=` query param a
 * test navigates with. Needed because store.ts's initTheme() reads only
 * localStorage and silently reverts the URL-driven theme right after
 * hydration (pre-existing bug, worked around here rather than fixed).
 */
export async function seedTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem('theme', t);
    } catch {
      /* localStorage may be unavailable pre-navigation; ignore */
    }
  }, theme);
}
