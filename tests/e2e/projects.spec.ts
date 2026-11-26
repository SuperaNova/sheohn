import { test, expect } from './fixtures';

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

test.describe('PDF embed on demand', () => {
  const pdfPattern = /AniMoIntelliJaysAPACSolutionsChallenge\.pdf/;

  test('desktop loads the PDF only after clicking Load document', async ({
    page,
  }) => {
    const pdfRequests: string[] = [];
    page.on('request', (request) => {
      if (pdfPattern.test(request.url())) pdfRequests.push(request.url());
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/projects/animo');

    const button = page.getByRole('button', { name: 'Load document' });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
    await expect(page.locator('iframe[title="AniMo Pitch Deck"]')).toHaveCount(
      0,
    );
    expect(pdfRequests).toHaveLength(0);

    await button.click();
    await expect(page.locator('iframe[title="AniMo Pitch Deck"]')).toHaveCount(
      1,
    );
  });

  test('mobile never mounts the iframe', async ({ page }) => {
    const pdfRequests: string[] = [];
    page.on('request', (request) => {
      if (pdfPattern.test(request.url())) pdfRequests.push(request.url());
    });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/projects/animo');
    await page.getByText('Open document ↗').scrollIntoViewIfNeeded();

    await expect(page.locator('iframe[title="AniMo Pitch Deck"]')).toHaveCount(
      0,
    );
    expect(pdfRequests).toHaveLength(0);
  });
});
