import { test, expect } from './fixtures';

test.describe('Primary navigation', () => {
  test('header links navigate to projects and about', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header');

    await header.getByRole('link', { name: 'Projects' }).click();
    await page.waitForURL('**/projects');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Case Studies' }),
    ).toBeVisible();

    await header.getByRole('link', { name: 'About' }).click();
    await page.waitForURL('**/about');
    await expect(page.getByRole('heading', { name: 'About Me' })).toBeVisible();
  });

  test('resume link opens in a new tab', async ({ page }) => {
    await page.goto('/');

    const resumeLink = page.locator('header').getByRole('link', {
      name: 'Resume',
    });
    // href points at the hosted résumé (Vercel Blob / filler), so assert it
    // resolves to a PDF and opens in a new tab — not a specific local path.
    await expect(resumeLink).toHaveAttribute('href', /\.pdf($|\?)/);
    await expect(resumeLink).toHaveAttribute('target', '_blank');
  });
});
