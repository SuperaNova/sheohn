import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { INDEX_UNAVAILABLE_MESSAGE } from '../../src/lib/shell/builtins/search';

// Reads the real, deployed policy from vercel.json instead of hardcoding a
// copy here — this suite always exercises whatever is actually shipped, and
// fails loudly if that file's shape ever changes underneath it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface VercelHeaderEntry {
  key: string;
  value: string;
}
interface VercelConfig {
  headers: { source: string; headers: VercelHeaderEntry[] }[];
}

const vercelConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf-8'),
) as VercelConfig;

function headerValue(key: string): string {
  const entry = vercelConfig.headers[0]?.headers.find((h) => h.key === key);
  if (!entry) throw new Error(`vercel.json is missing the "${key}" header`);
  return entry.value;
}

const CSP = headerValue('Content-Security-Policy');
const REPORTING_ENDPOINTS = headerValue('Reporting-Endpoints');

// The local webServer never sends vercel.json's headers (Vercel applies
// them at the edge), so inject the shipped policy on document responses —
// sub-resources inherit the document's CSP and need no header of their own.
async function applyTightenedCsp(page: Page) {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': CSP,
        'reporting-endpoints': REPORTING_ENDPOINTS,
      },
    });
  });
}

// Chromium/Firefox log CSP violations to the console with one of these
// substrings ("Refused to ..." / "Content Security Policy").
function isCspViolationMessage(text: string): boolean {
  return /content security policy|refused to (load|execute|connect|apply)/i.test(
    text,
  );
}

const deckInput = (page: Page) =>
  page.locator('input[aria-label^="Command deck"]');
const deck = (page: Page) => page.locator('aside[aria-label="Command Deck"]');

test.describe('Tightened CSP', () => {
  test('vercel.json no longer allows unsafe-eval and requires wasm-unsafe-eval', () => {
    expect(CSP).not.toContain("'unsafe-eval'");
    expect(CSP).toContain("'wasm-unsafe-eval'");
    expect(CSP).toContain('report-to csp-endpoint');
    expect(CSP).toContain('report-uri /api/csp-report');
  });

  test('animation-heavy surfaces produce zero CSP violations under the tightened policy', async ({
    page,
  }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (isCspViolationMessage(msg.text())) violations.push(msg.text());
    });

    await applyTightenedCsp(page);

    // PongGame canvas on the 404 page.
    await page.goto('/this-page-definitely-does-not-exist-csp-test');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('404');
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await canvas.hover();
    await page.waitForTimeout(300); // let a few requestAnimationFrame ticks run

    // Command deck open/close — the agent chat surface's Svelte island.
    await page.goto('/');
    await expect(deckInput(page)).toBeVisible();
    await expect(async () => {
      await deckInput(page).blur();
      await deckInput(page).focus();
      await expect(
        deck(page).getByRole('button', { name: /show me his resume/i }),
      ).toBeVisible();
    }).toPass({ timeout: 15000 });
    await page.keyboard.press('Escape');

    // `search` (not `grep`) loads Pagefind's WASM, exercising
    // 'wasm-unsafe-eval'. A real result line must render — the graceful
    // "index unavailable" fallback never compiles the module.
    await page.keyboard.press('Control+k');
    await deckInput(page).fill('search jared');
    await deckInput(page).press('Enter');
    const shellOutput = page.getByRole('log', { name: 'Shell output' });
    await expect(shellOutput).toBeVisible();
    await expect(shellOutput).not.toContainText(INDEX_UNAVAILABLE_MESSAGE);
    await expect(shellOutput).toContainText(/—.+\([^)]*\)/);
    await page.keyboard.press('Escape');

    // View transition — internal link navigation via Astro's ClientRouter.
    await page
      .locator('header')
      .getByRole('link', { name: 'Projects' })
      .click();
    await page.waitForURL('**/projects');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Case Studies' }),
    ).toBeVisible();

    // Theme toggle.
    await page.locator('[data-theme-toggle]:visible').first().click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    expect(violations).toEqual([]);
  });
});
