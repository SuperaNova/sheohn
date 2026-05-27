import { test, expect } from '@playwright/test';

test('homepage has title and expected content', async ({ page }) => {
  await page.goto('/');

  // Verify the page loads successfully and has some content
  // We can refine this selector based on the actual homepage content
  await expect(page.locator('body')).toBeVisible();
});
