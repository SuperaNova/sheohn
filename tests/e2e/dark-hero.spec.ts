import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const toggle = (page: Page) =>
  page.locator('[data-theme-toggle]:visible').first();
const deck = (page: Page) => page.locator('aside[aria-label="Command Deck"]');
const scene = (page: Page) => page.locator('.scene').first();

test.describe('Dark hero', () => {
  test('boots light with the scene and frame hidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect(scene(page)).toBeHidden();
    await expect(page.locator('.hero-frame')).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Jared Sheohn L. Acebes',
    );
    await expect(page.locator('.hero-currently')).toBeVisible();
  });

  test('toggle enters dark: scene visible, deck perches, docks on scroll, re-perches', async ({
    page,
  }) => {
    await page.goto('/');
    await toggle(page).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(scene(page)).toBeVisible();
    await expect(page.locator('.hero-frame')).toBeVisible();
    await expect(page.locator('.hero-currently')).toBeHidden();

    // Perched: right of centre, standing on the horizon above the fold.
    await expect(deck(page)).toHaveClass(/deck-perched/);
    const vw = page.viewportSize()!.width;
    await expect(async () => {
      const perchedBox = (await deck(page).boundingBox())!;
      expect(perchedBox.x).toBeGreaterThan(vw / 2);
    }).toPass({ timeout: 3_000 });

    // Scrolling past the hero docks it bottom-centre. Poll the geometry —
    // the glide takes ~650ms and the class flips at its start.
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.8));
    await expect(deck(page)).not.toHaveClass(/deck-perched/);
    await expect(async () => {
      const dockedBox = (await deck(page).boundingBox())!;
      expect(Math.abs(dockedBox.x + dockedBox.width / 2 - vw / 2)).toBeLessThan(
        40,
      );
    }).toPass({ timeout: 3_000 });

    // Scrolling back re-perches.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(deck(page)).toHaveClass(/deck-perched/);

    // Expanding un-perches and hands focus to the input, exactly as docked.
    await page.keyboard.press('Control+k');
    await expect(deck(page)).not.toHaveClass(/deck-perched/);
    await expect(page.getByLabel(/type a slash-command/i)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(deck(page)).toHaveClass(/deck-perched/);
  });

  test('reduced motion: instant swap, scene fully rendered, content opaque', async ({
    page,
  }) => {
    // The shared fixture already emulates prefers-reduced-motion: reduce.
    await page.goto('/');
    await toggle(page).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(
      await page.locator('html').getAttribute('data-theme-whoosh'),
    ).toBeNull();
    await expect(scene(page)).toBeVisible();
    const opacity = await page
      .locator('h1')
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(1);
  });

  test('power-on starter chip is offered in light and withdrawn in dark', async ({
    page,
  }) => {
    await page.goto('/');
    const chip = page
      .locator('#home button', { hasText: 'power on the instrument' })
      .first();
    await expect(chip).toBeVisible();
    await toggle(page).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(chip).toBeHidden();
  });
});

test.describe('Theme whoosh', () => {
  // These need real motion, so they build their own contexts instead of the
  // shared reduced-motion fixture.
  test('animated reveal gates and cleans up data-theme-whoosh', async ({
    browser,
    baseURL,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'startViewTransition is Chromium-only; other engines take the instant fallback below',
    );
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.addInitScript(() =>
      sessionStorage.setItem('loader-played', 'true'),
    );
    await page.goto('/');
    await page.locator('[data-theme-toggle]:visible').first().click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).not.toHaveAttribute(
      'data-theme-whoosh',
      '',
      { timeout: 5_000 },
    );
    await ctx.close();
  });

  test('missing View Transitions API falls back to an instant, error-free swap', async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.addInitScript(() => {
      sessionStorage.setItem('loader-played', 'true');
      delete (Document.prototype as { startViewTransition?: unknown })
        .startViewTransition;
    });
    await page.goto('/');
    await page.locator('[data-theme-toggle]:visible').first().click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(
      await page.locator('html').getAttribute('data-theme-whoosh'),
    ).toBeNull();
    expect(pageErrors).toEqual([]);
    await ctx.close();
  });
});
