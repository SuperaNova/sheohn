import { describe, expect, test, vi } from 'vitest';
import type { LimitOutcome } from './chat-guard';
import { MCP_MAX_BODY_BYTES, decideMcpAdmission } from './mcp-guard';

const NOW = 1_000_000;

const pass: LimitOutcome = {
  success: true,
  limit: 30,
  remaining: 29,
  reset: NOW + 60_000,
};
const fail: LimitOutcome = {
  success: false,
  limit: 30,
  remaining: 0,
  reset: NOW + 12_200,
};

const goodRequest = { origin: null, contentType: 'application/json' };

function checks(
  overrides: Partial<Parameters<typeof decideMcpAdmission>[1]> = {},
) {
  return {
    isDev: false,
    readBody: vi.fn(async () => '{"jsonrpc":"2.0"}'),
    limitIp: vi.fn(async () => pass as LimitOutcome | null),
    readKillSwitch: vi.fn(async () => null as unknown),
    now: () => NOW,
    ...overrides,
  };
}

describe('decideMcpAdmission', () => {
  test('admits a clean request and returns the body', async () => {
    expect(await decideMcpAdmission(goodRequest, checks())).toEqual({
      admit: true,
      body: '{"jsonrpc":"2.0"}',
    });
  });

  test.each(['https://sheohn.dev', 'https://www.sheohn.dev'])(
    'admits the allowed origin %s',
    async (origin) => {
      const result = await decideMcpAdmission(
        { ...goodRequest, origin },
        checks(),
      );
      expect(result.admit).toBe(true);
    },
  );

  test('rejects a foreign origin with 403 before anything else runs', async () => {
    const c = checks();
    expect(
      await decideMcpAdmission(
        { ...goodRequest, origin: 'https://evil.example' },
        c,
      ),
    ).toEqual({ admit: false, reason: 'forbidden_origin', status: 403 });
    expect(c.readBody).not.toHaveBeenCalled();
    expect(c.limitIp).not.toHaveBeenCalled();
    expect(c.readKillSwitch).not.toHaveBeenCalled();
  });

  test('rejects an unlisted sheohn.dev subdomain', async () => {
    const result = await decideMcpAdmission(
      { ...goodRequest, origin: 'https://evil.sheohn.dev' },
      checks(),
    );
    expect(result).toMatchObject({ admit: false, status: 403 });
  });

  test('localhost origins are only allowed in dev', async () => {
    const localhost = { ...goodRequest, origin: 'http://localhost:4321' };
    const loopback = { ...goodRequest, origin: 'http://127.0.0.1:3000' };
    expect(
      (await decideMcpAdmission(localhost, checks({ isDev: true }))).admit,
    ).toBe(true);
    expect(
      (await decideMcpAdmission(loopback, checks({ isDev: true }))).admit,
    ).toBe(true);
    expect(
      await decideMcpAdmission(localhost, checks({ isDev: false })),
    ).toMatchObject({ admit: false, status: 403 });
  });

  test('the dev localhost pattern does not match lookalike hosts', async () => {
    const result = await decideMcpAdmission(
      { ...goodRequest, origin: 'http://localhost.evil.example' },
      checks({ isDev: true }),
    );
    expect(result).toMatchObject({ admit: false, status: 403 });
  });

  test('rejects a non-JSON content type with 415 and reads nothing', async () => {
    const c = checks();
    expect(
      await decideMcpAdmission({ origin: null, contentType: 'text/plain' }, c),
    ).toEqual({ admit: false, reason: 'unsupported_media_type', status: 415 });
    expect(c.readBody).not.toHaveBeenCalled();
  });

  test('rejects a missing content type with 415', async () => {
    const result = await decideMcpAdmission(
      { origin: null, contentType: null },
      checks(),
    );
    expect(result).toMatchObject({ admit: false, status: 415 });
  });

  test('rejects an oversized body with 413 before the limiter', async () => {
    const c = checks({
      readBody: vi.fn(async () => 'x'.repeat(MCP_MAX_BODY_BYTES + 1)),
    });
    expect(await decideMcpAdmission(goodRequest, c)).toEqual({
      admit: false,
      reason: 'payload_too_large',
      status: 413,
    });
    expect(c.limitIp).not.toHaveBeenCalled();
  });

  test('admits a body exactly at the cap', async () => {
    const c = checks({
      readBody: vi.fn(async () => 'x'.repeat(MCP_MAX_BODY_BYTES)),
    });
    expect((await decideMcpAdmission(goodRequest, c)).admit).toBe(true);
  });

  test('counts bytes, not characters, against the cap', async () => {
    const c = checks({
      readBody: vi.fn(async () => 'é'.repeat(MCP_MAX_BODY_BYTES / 2 + 1)),
    });
    expect(await decideMcpAdmission(goodRequest, c)).toMatchObject({
      admit: false,
      status: 413,
    });
  });

  test('rejects with 429 and a retry-after when the IP limiter fails', async () => {
    const c = checks({ limitIp: vi.fn(async () => fail) });
    expect(await decideMcpAdmission(goodRequest, c)).toEqual({
      admit: false,
      reason: 'rate_limited',
      status: 429,
      retryAfterSeconds: 13,
    });
    expect(c.readKillSwitch).not.toHaveBeenCalled();
  });

  test('fails open when the limiter is unavailable', async () => {
    const c = checks({ limitIp: vi.fn(async () => null) });
    expect((await decideMcpAdmission(goodRequest, c)).admit).toBe(true);
  });

  test('rejects with 503 offline when the kill switch is on', async () => {
    const c = checks({ readKillSwitch: vi.fn(async () => '1') });
    expect(await decideMcpAdmission(goodRequest, c)).toEqual({
      admit: false,
      reason: 'offline',
      status: 503,
    });
  });

  test('a falsy kill switch value admits', async () => {
    const c = checks({ readKillSwitch: vi.fn(async () => 'false') });
    expect((await decideMcpAdmission(goodRequest, c)).admit).toBe(true);
  });
});
