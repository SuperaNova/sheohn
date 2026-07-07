import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

/**
 * Shared Playwright fixture for every visual-regression spec. Import `test`
 * and `expect` from here instead of `@playwright/test`.
 *
 * Deliberately separate from tests/e2e/fixtures.ts (spec 13's locked decision
 * keeps this suite fully independent of the e2e suite) even though the intent
 * overlaps:
 *  1. Emulates prefers-reduced-motion: reduce before every navigation — the
 *     `@media (prefers-reduced-motion: reduce)` block in global.css zeroes
 *     animation/transition durations (with !important, which wins over the
 *     inline animation-duration Svelte's transition runtime sets), so
 *     scroll-reveals, parallax, and the command deck's fly-in settle
 *     near-instantly instead of mid-flight when the screenshot is taken.
 *  2. Pre-seeds the once-per-session Loader overlay's sessionStorage flag via
 *     addInitScript (runs before any page script, so it's visible to
 *     BaseLayout's inline <head> script) — otherwise every fresh browser
 *     context would show the full-screen boot loader over the very first
 *     page it navigates to, making every snapshot flaky/non-representative.
 *     See src/layouts/BaseLayout.astro's inline script for the exact key.
 *  3. Freezes `Date` at a fixed instant. HeaderNav.svelte renders a live
 *     wall clock ("HH:mm (UTC+08:00)") from `new Date()` on mount and every
 *     30s — without this, every run captures a different time, guaranteeing
 *     a diff region in the header on each baseline comparison. The rendered
 *     offset is already deterministic (Intl.DateTimeFormat pinned to
 *     personalInfo.timezone, 'Asia/Manila' — not the machine timezone), so
 *     freezing the instant alone makes the whole string stable; the config's
 *     `timezoneId`/`locale` context options pin any other locale/timezone-
 *     dependent rendering across local-Windows and CI-ubuntu runs. The
 *     subclass keeps every other Date behavior intact (explicit-args
 *     constructor, parse/UTC statics, Intl interop), so page code that
 *     formats or compares dates is unaffected.
 */

// 2026-01-01T04:00:00Z — renders as "12:00 (UTC+08:00)" in the header's
// Asia/Manila clock. Arbitrary but fixed; keep as-is or all baselines with a
// visible clock must be regenerated.
const FROZEN_EPOCH_MS = Date.UTC(2026, 0, 1, 4, 0, 0);

// Raw string, NOT a function: Playwright's test-file transpiler rewrites TS
// class syntax with module-scope helpers before addInitScript stringifies a
// function into the page, where those helpers don't exist — the script then
// throws silently and the freeze never applies (observed: the header clock
// kept ticking). A string is injected verbatim, bypassing transpilation.
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
 * test is about to navigate with.
 *
 * Discovered while building this suite: BaseLayout.astro's inline pre-paint
 * script correctly honors the `?theme=` override on localhost (it wins over
 * localStorage there), but src/store.ts's `initTheme()` — run from
 * ThemeToggle.svelte's onMount, hydrated `client:load` inside HeaderNav —
 * reads ONLY `localStorage.getItem('theme')` with no URL-override awareness,
 * and re-applies/toggles the `dark` class from that alone. Because
 * HeaderNav hydrates near-instantly, this silently reverts the page to
 * whatever theme localStorage last held (default: 'light' in a fresh
 * context) shortly after the URL-driven theme was applied — meaning every
 * `?theme=dark` snapshot would otherwise render identically to
 * `?theme=light`. Seeding localStorage here keeps both mechanisms in
 * agreement, without touching any product source file (pre-existing bug,
 * out of scope for this suite to fix — see spec 13's implementation report).
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
