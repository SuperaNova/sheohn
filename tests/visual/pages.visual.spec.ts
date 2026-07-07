import { test, expect, seedTheme } from './fixtures';

// Route list per spec 13's locked decision. `animo` is confirmed as a real
// project slug (src/content/projects/animo.mdx exists alongside lexicon.mdx
// and crucible.mdx).
const ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'home' },
  { path: '/about', name: 'about' },
  { path: '/projects', name: 'projects' },
  { path: '/projects/animo', name: 'projects-animo' },
  { path: '/404', name: '404' },
];

const THEMES = ['light', 'dark'] as const;

// Hides CustomCursor.svelte's `.cursor-dot` element — a mouse-position-
// following dot that would otherwise vary run to run based on wherever
// Playwright's virtual pointer happens to be left.
const HIDE_CURSOR_CSS = '.cursor-dot { display: none !important; }';

for (const route of ROUTES) {
  for (const theme of THEMES) {
    test(`${route.name} (${theme})`, async ({ page }) => {
      // See fixtures.ts's seedTheme doc comment: keeps ThemeToggle's
      // hydration-time localStorage read in agreement with the URL override
      // below, so the theme doesn't silently revert right after hydration.
      await seedTheme(page, theme);
      // baseURL resolves to http://localhost:4397 — required for
      // BaseLayout.astro's ?theme= override, which only activates on
      // localhost/127.0.0.1 hostnames.
      await page.goto(`${route.path}?theme=${theme}`);
      await page.addStyleTag({ content: HIDE_CURSOR_CSS });
      // Inter / Playfair Display load from Google Fonts — waiting for
      // document.fonts.ready avoids a late font-swap causing flaky diffs.
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, {
        fullPage: true,
      });
    });
  }
}
