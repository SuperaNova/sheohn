import type { Page } from '@playwright/test';
import { test, expect, seedTheme } from './fixtures';

const THEMES = ['light', 'dark'] as const;

const HIDE_CURSOR_CSS = '.cursor-dot { display: none !important; }';

// CommandDeck.svelte is a hydrated island (client:idle) — its Ctrl+K handler
// isn't attached until hydration finishes, so the very first keypress after
// goto may be a no-op. Retry the press until the panel's "esc" collapse
// button (always rendered while expanded, regardless of boot-log/chat/
// command-palette content) becomes visible, proving the deck actually opened.
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
    // See fixtures.ts's seedTheme doc comment: keeps ThemeToggle's
    // hydration-time localStorage read in agreement with the URL override
    // below, so the theme doesn't silently revert right after hydration.
    await seedTheme(page, theme);
    // Seed the boot log's once-per-session flag (src/components/agent/
    // CommandDeck.svelte's BOOT_PLAYED_KEY) via addInitScript BEFORE
    // navigation, so this snapshot captures the steady-state deck panel
    // (shell/chat surface), not the fake BIOS boot animation.
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

    // Viewport-only (not fullPage): the deck is a fixed-position docked
    // element near the bottom of the viewport, not the scrollable page body.
    await expect(page).toHaveScreenshot(`deck-open-${theme}.png`, {
      fullPage: false,
    });
  });
}
