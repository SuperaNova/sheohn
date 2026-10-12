import { test as base, expect } from '@playwright/test';

/**
 * Shared e2e fixture; import `test`/`expect` from here. Before page scripts run it:
 *  1. emulates prefers-reduced-motion so transitions don't trip Playwright's stability check,
 *  2. pre-seeds the Loader's sessionStorage flag so its overlay never covers the deck,
 *  3. hides the Astro dev-toolbar, which sits over the deck (dev server only).
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
