import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIResponse } from '@playwright/test';
import {
  InfraError,
  describeResponse,
  isInfraStatus,
} from '../../src/lib/eval-infra';
import {
  getAssistantText,
  parseAgentResponse,
} from '../eval/parseAgentResponse';
import { bypassHeaders, expect, test } from './fixtures';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface VercelConfig {
  headers: { headers: { key: string; value: string }[] }[];
}

const shippedHeaderKeys = (
  JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf-8'),
  ) as VercelConfig
).headers.flatMap((entry) => entry.headers.map((header) => header.key));

const PROJECT_SLUG = 'animo';

const PAGES: { path: string; title: string | RegExp; status?: number }[] = [
  { path: '/', title: /Portfolio$/ },
  { path: '/projects/', title: 'Projects & Work' },
  { path: `/projects/${PROJECT_SLUG}`, title: /Case Study$/ },
  { path: '/about', title: 'About Me' },
  { path: '/status', title: 'Status' },
  { path: '/stats', title: 'Stats' },
  {
    path: '/smoke-test-missing-page',
    title: '404 | Page Not Found',
    status: 404,
  },
];

function describe(response: APIResponse): string {
  return `${response.url()} -> HTTP ${response.status()}`;
}

function extractTitle(html: string): string {
  const match = /<title>([^<]*)<\/title>/i.exec(html);
  return (match?.[1] ?? '').replace(/&amp;/g, '&').trim();
}

test.describe('pages', () => {
  for (const page of PAGES) {
    test(`${page.path} responds ${page.status ?? 200} with the expected title`, async ({
      api,
    }) => {
      const response = await api.get(page.path);
      expect(response.status(), describe(response)).toBe(page.status ?? 200);
      const title = extractTitle(await response.text());
      if (typeof page.title === 'string') {
        expect(title, describe(response)).toBe(page.title);
      } else {
        expect(title, describe(response)).toMatch(page.title);
      }
    });
  }
});

test('security headers are served on /', async ({ api }) => {
  const response = await api.get('/');
  expect(response.status(), describe(response)).toBe(200);
  const headers = response.headers();

  for (const key of shippedHeaderKeys) {
    expect(
      headers[key.toLowerCase()],
      `${key} missing on ${response.url()}`,
    ).toBeTruthy();
  }

  const csp = headers['content-security-policy'] ?? '';
  expect(csp, response.url()).toContain("default-src 'self'");
  expect(csp, response.url()).toContain("frame-ancestors 'none'");
  expect(csp, response.url()).toContain('report-uri /api/csp-report');
  expect(csp, response.url()).not.toContain("'unsafe-eval'");
});

test('an OG image route serves a PNG', async ({ api }) => {
  const response = await api.get('/og/home.png');
  expect(response.status(), describe(response)).toBe(200);
  expect(response.headers()['content-type'], describe(response)).toContain(
    'image/png',
  );
});

test.describe('api functions boot without side effects', () => {
  test('/api/contact rejects an invalid body with a JSON error', async ({
    api,
  }) => {
    const response = await api.post('/api/contact', { data: {} });
    expect(response.status(), describe(response)).toBeGreaterThanOrEqual(400);
    expect(response.status(), describe(response)).toBeLessThan(500);
    expect(response.headers()['content-type'], describe(response)).toContain(
      'application/json',
    );
    const body = (await response.json()) as { error?: unknown };
    expect(body.error, describe(response)).toBeTruthy();
  });

  for (const endpoint of ['/api/vitals', '/api/csp-report']) {
    test(`${endpoint} rejects an unsupported content type`, async ({ api }) => {
      const response = await api.post(endpoint, {
        headers: { 'content-type': 'application/xml' },
        data: 'smoke',
      });
      expect(response.status(), describe(response)).toBe(415);
    });
  }
});

test.describe('chat', () => {
  // A retry would spend a second Gemini call.
  test.describe.configure({ retries: 0 });

  test('/api/chat streams a reply', async ({ api }, testInfo) => {
    const response = await api.post('/api/chat', {
      data: {
        messages: [
          {
            id: 'smoke',
            role: 'user',
            parts: [{ type: 'text', text: 'What is 12 times 12?' }],
          },
        ],
      },
    });
    const status = response.status();
    const body = await response.text();

    if (status === 503) {
      let reason: unknown;
      try {
        reason = (JSON.parse(body) as { reason?: unknown }).reason;
      } catch {
        reason = undefined;
      }
      if (reason === 'busy' || reason === 'offline') {
        testInfo.annotations.push({
          type: 'skip-reason',
          description: `chat rejected the request: ${reason}`,
        });
        test.skip(true, `/api/chat is intentionally closed (${reason})`);
      }
    }

    if (isInfraStatus(status)) {
      throw new InfraError(
        `upstream problem on ${describe(response)}: ${describeResponse(status, body)}`,
      );
    }
    expect(status, `${describe(response)}: ${body.slice(0, 200)}`).toBe(200);

    expect(
      body.trim().length,
      `empty body from ${describe(response)} (${response.headers()['content-type']})`,
    ).toBeGreaterThan(0);
    const message = await parseAgentResponse(body, status);
    expect(
      getAssistantText(message).trim().length,
      `empty reply from ${describe(response)}`,
    ).toBeGreaterThan(0);
  });
});

test('home hydrates with no console errors or CSP violation reports', async ({
  page,
  baseURL,
}) => {
  const problems: string[] = [];
  const origin = new URL(baseURL ?? '').origin;

  page.on('console', (msg) => {
    if (msg.type() === 'error')
      problems.push(
        `console: ${msg.text()} (${msg.location().url.slice(0, 80)})`,
      );
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/api/csp-report') {
      problems.push(`csp report sent: ${req.url()}`);
    }
  });

  // Same-origin only, so third-party hosts never see the bypass header.
  const headers = bypassHeaders();
  if (Object.keys(headers).length > 0) {
    await page.route(`${origin}/**`, (route) =>
      route.continue({ headers: { ...route.request().headers(), ...headers } }),
    );
  }

  const response = await page.goto('/');
  expect(response?.status(), `GET ${origin}/`).toBe(200);
  await expect(page.locator('input[aria-label^="Command deck"]')).toBeVisible();
  await page.waitForTimeout(1000); // let late CSP reports and lazy islands surface

  expect(problems, `problems on ${origin}/`).toEqual([]);
});
