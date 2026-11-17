import { test, expect } from './fixtures';

const notice = '[data-testid="stale-notice"]';

test.describe('Stale-info notice', () => {
  test('forced on: visible, dismissible, stays dismissed, clears the hero', async ({
    page,
  }) => {
    await page.goto('/?notice=on');
    const strip = page.locator(notice);
    await expect(strip).toBeVisible();
    await expect(strip).toContainText(/last reviewed|light maintenance/);

    const stripBox = await strip.boundingBox();
    const kickerBox = await page
      .locator('p.hero-item', { hasText: '›' })
      .first()
      .boundingBox();
    expect(stripBox).not.toBeNull();
    expect(kickerBox).not.toBeNull();
    expect(stripBox!.y + stripBox!.height).toBeLessThanOrEqual(kickerBox!.y);

    await page.getByRole('button', { name: 'Dismiss notice' }).click();
    await expect(strip).toHaveCount(0);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator(notice)).toHaveCount(0);
  });

  test('forced off: never rendered', async ({ page }) => {
    await page.goto('/?notice=off');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(notice)).toHaveCount(0);
  });

  test('no override: hidden under automation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(notice)).toHaveCount(0);
  });
});
