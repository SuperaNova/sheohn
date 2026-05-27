import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Home page', () => {
  test('loads hero and featured projects section', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Jared Sheohn L\. Acebes/i);
    await expect(
      page.getByRole('heading', { level: 1, name: /Jared Sheohn L\. Acebes/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'View All Projects' }),
    ).toHaveAttribute('href', '/projects');
    await expect(page.locator('section#projects')).toBeVisible();

    // Accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['landmark-complementary-is-top-level', 'landmark-unique'])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Visual regression test
    await expect(page).toHaveScreenshot('homepage.png', { fullPage: true });
  });

  test('footer navigation routes to stack section', async ({ page }) => {
    await page.goto('/');

    const footer = page.locator('footer');
    await footer.getByRole('link', { name: 'Stack' }).click();
    await page.waitForURL('**/about#stack');
    const techStackHeading = page.getByRole('heading', { name: 'Tech Stack' });
    await techStackHeading.scrollIntoViewIfNeeded();
    await expect(techStackHeading).toBeVisible();
  });
});
