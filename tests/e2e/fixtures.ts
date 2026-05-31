import { test as base, expect } from '@playwright/test';

/**
 * Shared Playwright fixture for every e2e spec. Import `test` and `expect` from
 * here instead of @playwright/test.
 *
 * It does three things, all before the page's own scripts run:
 *  1. Emulates prefers-reduced-motion: reduce — the global override in
 *     global.css then zeroes transitions/animations so SectionReveal / parallax
 *     / fly-ins don't keep elements moving and trip Playwright's stability check.
 *  2. Skips the boot loader by pre-seeding its sessionStorage flag, so the
 *     full-screen z-200 overlay never covers the docked command deck (which the
 *     deck tests interact with immediately after load).
 *  3. Hides the Astro dev-toolbar, which is docked at the bottom-centre — right
 *     on top of the command deck — and otherwise intercepts pointer/focus.
 *     This only exists in `astro dev`; harmless when running against a build.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('loader-played', 'true');
      } catch {
        /* sessionStorage may be unavailable pre-navigation; ignore */
      }
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar{display:none !important;}';
      document.addEventListener('DOMContentLoaded', () =>
        document.head.appendChild(style),
      );
    });
    await use(page);
  },
});

export { expect };
