import { test, expect } from './fixtures';
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
  });

  test('contact section renders at the bottom of home', async ({ page }) => {
    await page.goto('/#contact');

    const contact = page.locator('section#contact');
    await contact.scrollIntoViewIfNeeded();
    await expect(
      contact.getByRole('heading', { name: /build something|get in touch/i }),
    ).toBeVisible();
    await expect(
      contact.getByRole('link', { name: 'jared.acebes@gmail.com' }),
    ).toBeVisible();
  });
});
