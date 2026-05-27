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
    // Discover a real slug from the listing so this test stays valid as
    // case studies are added or renamed — no hardcoded titles.
    await page.goto('/projects');
    const firstHref = await page
      .locator('a[aria-label^="View case study:"]')
      .first()
      .getAttribute('href');

    if (!firstHref) {
      throw new Error('No case studies found on /projects');
    }

    await page.goto(firstHref);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });
});
