import { test, expect, seedTheme } from './fixtures';

// `animo` is a real project slug (src/content/projects/animo.mdx).
const ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'home' },
  { path: '/about', name: 'about' },
  { path: '/projects', name: 'projects' },
  { path: '/projects/animo', name: 'projects-animo' },
  { path: '/404', name: '404' },
];

const THEMES = ['light', 'dark'] as const;

// Hides CustomCursor's `.cursor-dot`, whose position varies with Playwright's pointer.
const HIDE_CURSOR_CSS = '.cursor-dot { display: none !important; }';

for (const route of ROUTES) {
  for (const theme of THEMES) {
    test(`${route.name} (${theme})`, async ({ page }) => {
      // Keeps ThemeToggle's hydration-time localStorage read in agreement with the URL override.
      await seedTheme(page, theme);
      // baseURL is localhost, which BaseLayout's ?theme= override requires.
      await page.goto(`${route.path}?theme=${theme}`);
      await page.addStyleTag({ content: HIDE_CURSOR_CSS });
      // Wait for fonts to avoid a late font-swap causing flaky diffs.
      await page.evaluate(() => document.fonts.ready);

      await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, {
        fullPage: true,
      });
    });
  }
}
