import { test, expect } from '@playwright/test';

test.describe('Projects', () => {
  test('projects list renders and opens a case study', async ({ page }) => {
    await page.goto('/projects');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Case Studies' }),
    ).toBeVisible();

    const firstCard = page.locator('a[aria-label^="View case study:"]').first();
    await expect(firstCard).toBeVisible();

    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/^\/projects\//);

    await firstCard.click();
    await page.waitForURL(/\/projects\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('direct project slug loads content', async ({ page }) => {
    await page.goto('/projects/eco-architecture');

    await expect(
      page.getByRole('heading', { level: 1, name: 'EcoArchitecture Core' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });
});
