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

vi.mock('astro:content', () => ({
  getCollection: async () => [],
}));

const recordVital = vi.fn(async () => {});
const recordPageview = vi.fn(async () => {});
vi.mock('./rum-redis', () => ({
  recordVital: (...args: unknown[]) =>
    (recordVital as (...a: unknown[]) => unknown)(...args),
  recordPageview: (...args: unknown[]) =>
    (recordPageview as (...a: unknown[]) => unknown)(...args),
  utcDateString: () => '2026-01-01',
}));

import { POST } from '../pages/api/vitals';

function post(body: unknown) {
  const request = new Request('http://localhost/api/vitals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return POST({ request, clientAddress: '1.2.3.4' } as never);
}

beforeEach(() => {
  calls.length = 0;
  limitResults = {};
  recordVital.mockClear();
  recordPageview.mockClear();
});

describe('POST /api/vitals', () => {
  test('checks the per-IP limiter before the global one', async () => {
    await post({ route: '/', metric: 'lcp', value: 1000 });
    expect(calls).toEqual(['ratelimit_vitals_ip', 'ratelimit_vitals']);
  });

  test('429s on the per-IP limiter without spending the global budget', async () => {
    limitResults['ratelimit_vitals_ip'] = { success: false };
    const response = await post({ route: '/', metric: 'lcp', value: 1000 });
    expect(response.status).toBe(429);
    expect(calls).toEqual(['ratelimit_vitals_ip']);
  });

  test.each([
    ['lcp', 60_001],
    ['inp', 60_001],
    ['cls', 10.5],
  ])(
    'drops an out-of-range %s beacon (%s) without recording',
    async (metric, value) => {
      const response = await post({ route: '/', metric, value });
      expect(response.status).toBe(204);
      expect(recordVital).not.toHaveBeenCalled();
    },
  );

  test('records a value exactly at the maximum', async () => {
    await post({ route: '/', metric: 'lcp', value: 60_000 });
    expect(recordVital).toHaveBeenCalledTimes(1);
  });

  test('400s a negative value at the schema', async () => {
    const response = await post({ route: '/', metric: 'lcp', value: -1 });
    expect(response.status).toBe(400);
    expect(recordVital).not.toHaveBeenCalled();
  });
});
