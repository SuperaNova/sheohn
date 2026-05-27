import { test, expect } from '@playwright/test';

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
    await expect(resumeLink).toHaveAttribute('href', '/resume.pdf');
    await expect(resumeLink).toHaveAttribute('target', '_blank');
  });
});
