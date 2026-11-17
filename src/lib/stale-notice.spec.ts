import { describe, expect, test } from 'vitest';
import {
  freshnessNote,
  isInfoStale,
  monthsBetween,
  noticeText,
  parseNoticeOverride,
  resolveNotice,
} from './stale-notice';

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('monthsBetween', () => {
  test('counts whole months across a year boundary', () => {
    expect(monthsBetween('2025-11-17', utc('2026-02-17'))).toBe(3);
    expect(monthsBetween('2025-11-17', utc('2026-02-16'))).toBe(2);
  });
  test('same day is zero and the past clamps to zero', () => {
    expect(monthsBetween('2026-11-17', utc('2026-11-17'))).toBe(0);
    expect(monthsBetween('2026-11-17', utc('2026-01-01'))).toBe(0);
  });
});

describe('isInfoStale', () => {
  test('exactly six months is not stale, one day more is', () => {
    expect(isInfoStale('2026-01-10', utc('2026-07-10'), 6)).toBe(false);
    expect(isInfoStale('2026-01-10', utc('2026-07-11'), 6)).toBe(true);
  });
  test('recent dates are fresh', () => {
    expect(isInfoStale('2026-11-17', utc('2026-11-18'), 6)).toBe(false);
  });
});

describe('noticeText', () => {
  const base = {
    reviewedOn: '2026-11-17',
    today: utc('2027-08-01'),
    months: 6,
    message: '',
  };
  test('auto wording formats the date en-GB', () => {
    expect(noticeText({ ...base, mode: 'auto' })).toBe(
      'info last reviewed 17 Nov 2026 · older than 6 months, some of this is probably out of date',
    );
  });
  test('mode on uses default or custom message', () => {
    expect(noticeText({ ...base, mode: 'on' })).toBe(
      'site under light maintenance · some info may be out of date',
    );
    expect(noticeText({ ...base, mode: 'on', message: 'back soon' })).toBe(
      'back soon',
    );
  });
});

describe('parseNoticeOverride', () => {
  test('honors on/off on loopback hosts only', () => {
    expect(parseNoticeOverride('?notice=on', 'localhost')).toBe('on');
    expect(parseNoticeOverride('?notice=off', '127.0.0.1')).toBe('off');
    expect(parseNoticeOverride('?notice=maybe', 'localhost')).toBeNull();
    expect(parseNoticeOverride('', 'localhost')).toBeNull();
    expect(parseNoticeOverride('?notice=on', 'sheohn.dev')).toBeNull();
  });
  test('rejects lookalike hostnames', () => {
    expect(
      parseNoticeOverride('?notice=on', 'localhost.evil.example'),
    ).toBeNull();
    expect(parseNoticeOverride('?notice=on', 'evil-localhost')).toBeNull();
  });
});

describe('resolveNotice precedence', () => {
  const stale = {
    mode: 'auto' as const,
    reviewedOn: '2025-01-01',
    today: utc('2026-01-01'),
    months: 6,
    message: '',
    override: null,
    automated: false,
  };
  test('auto shows only when stale', () => {
    expect(resolveNotice(stale).show).toBe(true);
    expect(resolveNotice({ ...stale, reviewedOn: '2025-12-01' }).show).toBe(
      false,
    );
  });
  test('mode on forces, mode off silences', () => {
    expect(
      resolveNotice({ ...stale, mode: 'on', reviewedOn: '2026-01-01' }).show,
    ).toBe(true);
    expect(resolveNotice({ ...stale, mode: 'off' }).show).toBe(false);
  });
  test('automation hides over mode, but override wins over automation', () => {
    expect(resolveNotice({ ...stale, mode: 'on', automated: true }).show).toBe(
      false,
    );
    expect(
      resolveNotice({ ...stale, automated: true, override: 'on' }).show,
    ).toBe(true);
  });
  test('override beats mode', () => {
    expect(resolveNotice({ ...stale, mode: 'off', override: 'on' }).show).toBe(
      true,
    );
    expect(resolveNotice({ ...stale, mode: 'on', override: 'off' }).show).toBe(
      false,
    );
  });
});

describe('freshnessNote', () => {
  test('fresh variant is a single factual line', () => {
    expect(freshnessNote('2026-11-17', utc('2027-01-20'), 6)).toBe(
      'FRESHNESS: Jared last reviewed these facts on 2026-11-17 (2 months ago).',
    );
  });
  test('stale variant adds the caveat', () => {
    const note = freshnessNote('2026-11-17', utc('2027-07-20'), 6);
    expect(note).toContain('(8 months ago).');
    expect(note).toContain('may be out of date');
  });
});
