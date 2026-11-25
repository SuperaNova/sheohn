import { test, expect } from '@playwright/test';

const overlay = '#global-loader';

test.describe('Boot overlay', () => {
  test('is visible after load and gone within 4s on a fast link', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator(overlay)).toBeVisible();
    await expect(page.locator(overlay)).toBeHidden({ timeout: 4000 });
  });

  test('clears by 2.5s after domcontentloaded on a throttled link', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'CDP throttling is Chromium-only');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 400,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (400 * 1024) / 8,
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(overlay)).toBeHidden({ timeout: 2500 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
