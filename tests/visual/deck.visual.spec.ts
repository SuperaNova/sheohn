import type { Page } from '@playwright/test';
import { test, expect, seedTheme } from './fixtures';

const THEMES = ['light', 'dark'] as const;

const HIDE_CURSOR_CSS = '.cursor-dot { display: none !important; }';

// CommandDeck is a hydrated island: retry Ctrl+K until the "esc" collapse button shows,
// proving the deck opened.
async function openDeck(page: Page) {
  const collapseButton = page.getByRole('button', {
    name: 'Collapse command deck',
  });
  await expect(async () => {
    await page.keyboard.press('Control+k');
    await expect(collapseButton).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
}

for (const theme of THEMES) {
  test(`command deck open (${theme})`, async ({ page }) => {
    // Keeps ThemeToggle's hydration-time localStorage read in agreement with the URL override.
    await seedTheme(page, theme);
    // Seed the boot log's once-per-session flag so the snapshot shows the steady-state panel.
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('deck-boot-played', 'true');
      } catch {
        /* sessionStorage may be unavailable pre-navigation; ignore */
      }
    });
    await page.goto(`/?theme=${theme}`);
    await page.addStyleTag({ content: HIDE_CURSOR_CSS });
    await page.evaluate(() => document.fonts.ready);

    await openDeck(page);

    // Viewport-only: the deck is a fixed element near the viewport bottom.
    await expect(page).toHaveScreenshot(`deck-open-${theme}.png`, {
      fullPage: false,
    });
  });
}
