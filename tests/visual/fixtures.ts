import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

/**
 * Shared visual-suite fixture (independent of tests/e2e/fixtures.ts): emulates reduced motion,
 * pre-seeds the Loader's sessionStorage flag, and freezes `Date` so the header clock can't diff.
 */

// 2026-01-01T04:00:00Z renders as "12:00 (UTC+08:00)" in the header clock; changing it
// invalidates every baseline showing the clock.
const FROZEN_EPOCH_MS = Date.UTC(2026, 0, 1, 4, 0, 0);

// Raw string, not a function: Playwright's TS transpile leaves module-scope helpers
// missing in-page, so a function-form init script silently fails.
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
 * Seeds localStorage 'theme' to match the `?theme=` param; initTheme() reads only
 * localStorage and would revert the URL-driven theme after hydration.
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
