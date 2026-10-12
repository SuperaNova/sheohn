import { describe, expect, test, vi } from 'vitest';
import {
  chatErrorNotice,
  decideChatAdmission,
  isKillSwitchOn,
  rejectionReasonFromError,
  type LimitOutcome,
} from './chat-guard';

const NOW = 1_000_000;

const pass: LimitOutcome = {
  success: true,
  limit: 10,
  remaining: 9,
  reset: NOW + 60_000,
};
const fail: LimitOutcome = {
  success: false,
  limit: 10,
  remaining: 0,
  reset: NOW + 30_500,
};

function checks(
  overrides: Partial<Parameters<typeof decideChatAdmission>[0]> = {},
) {
  return {
    readKillSwitch: vi.fn(async () => null as unknown),
    limitIp: vi.fn(async () => pass as LimitOutcome | null),
    limitGlobal: vi.fn(async () => pass as LimitOutcome | null),
    limitDaily: vi.fn(async () => pass as LimitOutcome | null),
    now: () => NOW,
    ...overrides,
  };
}

describe('decideChatAdmission', () => {
  test('admits when every guard passes', async () => {
    expect(await decideChatAdmission(checks())).toEqual({ admit: true });
  });

  test('kill switch wins and skips every limiter', async () => {
    const c = checks({ readKillSwitch: vi.fn(async () => '1') });
    expect(await decideChatAdmission(c)).toEqual({
      admit: false,
      reason: 'offline',
      status: 503,
    });
    expect(c.limitIp).not.toHaveBeenCalled();
    expect(c.limitGlobal).not.toHaveBeenCalled();
    expect(c.limitDaily).not.toHaveBeenCalled();
  });

  test('per-IP rejection is a 429 with the limit outcome and skips later guards', async () => {
    const c = checks({ limitIp: vi.fn(async () => fail) });
    expect(await decideChatAdmission(c)).toEqual({
      admit: false,
      reason: 'rate_limited',
      status: 429,
      retryAfterSeconds: 31,
      ipLimit: fail,
    });
    expect(c.limitGlobal).not.toHaveBeenCalled();
    expect(c.limitDaily).not.toHaveBeenCalled();
  });

  test('global limit rejects as busy before the daily budget is spent', async () => {
    const c = checks({ limitGlobal: vi.fn(async () => fail) });
    expect(await decideChatAdmission(c)).toMatchObject({
      admit: false,
      reason: 'busy',
      status: 503,
      retryAfterSeconds: 31,
    });
    expect(c.limitDaily).not.toHaveBeenCalled();
  });

  test('daily budget rejects as busy', async () => {
    const c = checks({ limitDaily: vi.fn(async () => fail) });
    expect(await decideChatAdmission(c)).toMatchObject({
      admit: false,
      reason: 'busy',
      status: 503,
    });
  });

  test('every guard failing open admits the request', async () => {
    const c = checks({
      limitIp: vi.fn(async () => null),
      limitGlobal: vi.fn(async () => null),
      limitDaily: vi.fn(async () => null),
    });
    expect(await decideChatAdmission(c)).toEqual({ admit: true });
  });

  test('retry-after never drops below one second', async () => {
    const c = checks({
      limitIp: vi.fn(async () => ({ ...fail, reset: NOW - 5 })),
    });
    expect(await decideChatAdmission(c)).toMatchObject({
      retryAfterSeconds: 1,
    });
  });
});

describe('isKillSwitchOn', () => {
  test.each(['1', 1, 'true', 'on', 'maintenance'])('%s is on', (value) => {
    expect(isKillSwitchOn(value)).toBe(true);
  });

  test.each([null, undefined, '', '0', 0, 'false', false, ' FALSE '])(
    '%s is off',
    (value) => {
      expect(isKillSwitchOn(value)).toBe(false);
    },
  );
});

describe('rejection errors', () => {
  const rejection = (reason: string) =>
    new Error(JSON.stringify({ reason, retryAfterSeconds: 5 }));

  test('reads the reason out of the transport error message', () => {
    expect(rejectionReasonFromError(rejection('busy'))).toBe('busy');
  });

  test('returns null for unknown reasons, plain text and non-errors', () => {
    expect(rejectionReasonFromError(rejection('weird'))).toBeNull();
    expect(rejectionReasonFromError(new Error('Bad Request'))).toBeNull();
    expect(rejectionReasonFromError(new Error('null'))).toBeNull();
    expect(rejectionReasonFromError('busy')).toBeNull();
  });

  test('maps each reason to its in-persona line', () => {
    expect(chatErrorNotice(rejection('rate_limited'))).toMatch(/too many/);
    expect(chatErrorNotice(rejection('busy'))).toMatch(/swamped/);
    expect(chatErrorNotice(rejection('offline'))).toMatch(/maintenance/);
  });

  test('falls back to the generic line', () => {
    expect(chatErrorNotice(new Error('Payload Too Large'))).toBe(
      "Couldn't reach the agent. Try again.",
    );
  });
});
