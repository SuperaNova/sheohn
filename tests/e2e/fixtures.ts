import { test as base, expect } from '@playwright/test';

/**
 * Shared Playwright fixture that emulates prefers-reduced-motion: reduce on
 * every page. The global override in src/styles/global.css then zeroes CSS
 * transitions and animations so SectionReveal / parallax / fly-in effects
 * don't keep elements moving and trip Playwright's "element is not stable"
 * actionability check.
 *
 * Import `test` and `expect` from this file instead of @playwright/test in
 * every e2e spec.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await use(page);
  },
});

export { expect };
