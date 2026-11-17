import { test, expect } from './fixtures';

test.describe('Now page', () => {
  test('shows the heading and the updated date', async ({ page }) => {
    await page.goto('/now');

    await expect(page.getByRole('heading', { name: 'Now' })).toBeVisible();
    await expect(page.locator('time')).toHaveAttribute(
      'datetime',
      '2026-11-17',
    );
  });
});
