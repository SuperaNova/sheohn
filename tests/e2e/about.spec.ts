import { test, expect } from './fixtures';

test.describe('About page', () => {
  test('shows about and tech stack sections', async ({ page }) => {
    await page.goto('/about');

    await expect(page.getByRole('heading', { name: 'About Me' })).toBeVisible();

    const techStackHeading = page.getByRole('heading', { name: 'Tech Stack' });
    await techStackHeading.scrollIntoViewIfNeeded();
    await expect(techStackHeading).toBeVisible();
  });
});
