import { beforeEach, describe, expect, test, vi } from 'vitest';

const calls: string[] = [];
let limitResults: Record<string, { success: boolean }> = {};

vi.mock('./ratelimit', () => ({
  createRateLimiter: (prefix: string) => ({ prefix }),
  safeLimit: async (limiter: { prefix: string }) => {
    calls.push(limiter.prefix);
    return limitResults[limiter.prefix] ?? { success: true };
  },
}));

const recordViolation = vi.fn(async () => {});
vi.mock('./csp-redis', () => ({
  recordViolation: (...args: unknown[]) =>
    (recordViolation as (...a: unknown[]) => unknown)(...args),
}));

import { POST } from '../pages/api/csp-report';

function post(body: unknown, headers: Record<string, string> = {}) {
  const request = new Request('http://localhost/api/csp-report', {
    method: 'POST',
    headers: { 'content-type': 'application/csp-report', ...headers },
    body: JSON.stringify(body),
  });
  return POST({ request, clientAddress: '1.2.3.4' } as never);
}

const validReport = {
  'csp-report': {
    'document-uri': 'https://sheohn.dev/',
    'violated-directive': 'script-src',
    'blocked-uri': 'inline',
  },
};

beforeEach(() => {
  calls.length = 0;
  limitResults = {};
  recordViolation.mockClear();
});

describe('POST /api/csp-report', () => {
  test('checks the per-IP limiter before the global one', async () => {
    await post(validReport);
    expect(calls).toEqual([
      'ratelimit_csp_report',
      'ratelimit_csp_report_global',
    ]);
  });

  test('429s on the global limiter without recording anything', async () => {
    limitResults['ratelimit_csp_report_global'] = { success: false };
    const response = await post(validReport);
    expect(response.status).toBe(429);
    expect(recordViolation).not.toHaveBeenCalled();
  });

  test('does not spend the global budget when the per-IP limiter rejects', async () => {
    limitResults['ratelimit_csp_report'] = { success: false };
    const response = await post(validReport);
    expect(response.status).toBe(429);
    expect(calls).toEqual(['ratelimit_csp_report']);
  });

  test('204s a foreign-host report without recording it', async () => {
    const response = await post({
      'csp-report': {
        ...validReport['csp-report'],
        'document-uri': 'https://evil.example.com/',
      },
    });
    expect(response.status).toBe(204);
    expect(recordViolation).not.toHaveBeenCalled();
  });

  test('records a valid report', async () => {
    const response = await post(validReport);
    expect(response.status).toBe(204);
    expect(recordViolation).toHaveBeenCalledWith({
      directive: 'script-src',
      blockedUri: 'inline',
    });
  });

  test('413s a declared oversized body before any limiter runs', async () => {
    const response = await post(validReport, { 'content-length': '999999' });
    expect(response.status).toBe(413);
    expect(calls).toEqual([]);
  });
});
