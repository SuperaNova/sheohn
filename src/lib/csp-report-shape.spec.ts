import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  ALLOWED_REPORT_HOSTS,
  normalizeCspReportBody,
} from './csp-report-shape';

const SITE = 'https://sheohn.dev/';

function legacy(report: Record<string, string>, documentUri = SITE) {
  return { 'csp-report': { 'document-uri': documentUri, ...report } };
}

function reportingEntry(
  body: Record<string, string>,
  url = SITE,
  type = 'csp-violation',
) {
  return { type, url, body };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('normalizeCspReportBody — legacy report-uri shape', () => {
  test('extracts directive and reduces blockedUri to its origin', () => {
    expect(
      normalizeCspReportBody(
        legacy({
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.example.com/x.js?q=1',
        }),
      ),
    ).toEqual([
      { directive: 'script-src', blockedUri: 'https://evil.example.com' },
    ]);
  });

  test('prefers effective-directive over violated-directive when both present', () => {
    expect(
      normalizeCspReportBody(
        legacy({
          'violated-directive': 'style-src 2.0',
          'effective-directive': 'script-src',
          'blocked-uri': 'inline',
        }),
      ),
    ).toEqual([{ directive: 'script-src', blockedUri: 'inline' }]);
  });

  test('strips a policy suffix from the directive name', () => {
    expect(
      normalizeCspReportBody(
        legacy({
          'violated-directive': "script-src 'self' https://x.test",
          'blocked-uri': 'eval',
        }),
      ),
    ).toEqual([{ directive: 'script-src', blockedUri: 'eval' }]);
  });

  test('rejects a report with no directive', () => {
    expect(normalizeCspReportBody(legacy({}))).toEqual([]);
  });
});

describe('normalizeCspReportBody — Reporting API report-to shape', () => {
  test('extracts every entry from a batch array', () => {
    expect(
      normalizeCspReportBody([
        reportingEntry({
          effectiveDirective: 'style-src',
          blockedURL: 'https://evil.example.com/x.css',
        }),
        reportingEntry({
          effectiveDirective: 'img-src',
          blockedURL: 'inline',
        }),
      ]),
    ).toEqual([
      { directive: 'style-src', blockedUri: 'https://evil.example.com' },
      { directive: 'img-src', blockedUri: 'inline' },
    ]);
  });

  test('falls back to the legacy blockedURI field name', () => {
    expect(
      normalizeCspReportBody([
        reportingEntry({
          effectiveDirective: 'script-src',
          blockedURI: 'eval',
        }),
      ]),
    ).toEqual([{ directive: 'script-src', blockedUri: 'eval' }]);
  });

  test('filters out non-csp-violation report types in the same batch', () => {
    expect(
      normalizeCspReportBody([
        reportingEntry({}, SITE, 'deprecation'),
        reportingEntry({
          effectiveDirective: 'connect-src',
          blockedURL: 'wss://x.test/socket',
        }),
      ]),
    ).toEqual([{ directive: 'connect-src', blockedUri: 'wss://x.test' }]);
  });

  test('accepts an entry with no type field at all', () => {
    expect(
      normalizeCspReportBody([
        {
          url: SITE,
          body: { effectiveDirective: 'font-src', blockedURL: 'data' },
        },
      ]),
    ).toEqual([{ directive: 'font-src', blockedUri: 'data' }]);
  });

  test('drops entries with a foreign host but keeps the rest of the batch', () => {
    expect(
      normalizeCspReportBody([
        reportingEntry(
          { effectiveDirective: 'script-src', blockedURL: 'inline' },
          'https://evil.example.com/',
        ),
        reportingEntry({
          effectiveDirective: 'script-src',
          blockedURL: 'inline',
        }),
      ]),
    ).toHaveLength(1);
  });
});

describe('normalizeCspReportBody — document host', () => {
  const body = { 'violated-directive': 'script-src', 'blocked-uri': 'inline' };

  test('accepts every allowed production host', () => {
    expect(ALLOWED_REPORT_HOSTS).toEqual(['sheohn.dev', 'www.sheohn.dev']);
    for (const host of ALLOWED_REPORT_HOSTS) {
      expect(
        normalizeCspReportBody(legacy(body, `https://${host}/a`)),
      ).toHaveLength(1);
    }
  });

  test('rejects a foreign host', () => {
    expect(
      normalizeCspReportBody(legacy(body, 'https://evil.example.com/')),
    ).toEqual([]);
    expect(
      normalizeCspReportBody(legacy(body, 'https://sheohn.dev.evil.com/')),
    ).toEqual([]);
  });

  test('rejects a missing document URL', () => {
    expect(normalizeCspReportBody({ 'csp-report': { ...body } })).toEqual([]);
    expect(
      normalizeCspReportBody([
        { type: 'csp-violation', body: { effectiveDirective: 'script-src' } },
      ]),
    ).toEqual([]);
  });

  test('rejects a malformed document URL', () => {
    expect(normalizeCspReportBody(legacy(body, 'not a url'))).toEqual([]);
  });

  test('allows localhost in dev only', () => {
    vi.stubEnv('DEV', true);
    expect(
      normalizeCspReportBody(legacy(body, 'http://localhost:4321/')),
    ).toHaveLength(1);
    expect(
      normalizeCspReportBody(legacy(body, 'http://127.0.0.1:4321/')),
    ).toHaveLength(1);
    vi.stubEnv('DEV', false);
    expect(
      normalizeCspReportBody(legacy(body, 'http://localhost:4321/')),
    ).toEqual([]);
  });
});

describe('normalizeCspReportBody — directive allowlist', () => {
  test('rejects a directive outside the allowlist', () => {
    expect(
      normalizeCspReportBody(
        legacy({
          'violated-directive': 'made-up-src',
          'blocked-uri': 'inline',
        }),
      ),
    ).toEqual([]);
  });

  test('rejects free text in the directive field', () => {
    expect(
      normalizeCspReportBody(
        legacy({
          'violated-directive': '<script>alert(1)</script>',
          'blocked-uri': 'inline',
        }),
      ),
    ).toEqual([]);
  });
});

describe('normalizeCspReportBody — blockedUri reduction', () => {
  const reduce = (blocked: string) =>
    normalizeCspReportBody(
      legacy({ 'violated-directive': 'img-src', 'blocked-uri': blocked }),
    )[0]?.blockedUri;

  test('reduces a URL to scheme and host', () => {
    expect(reduce('https://evil.example.com:8443/path?secret=1#x')).toBe(
      'https://evil.example.com:8443',
    );
  });

  test('keeps a CSP keyword', () => {
    for (const keyword of [
      'inline',
      'eval',
      'data',
      'blob',
      'self',
      'wasm-eval',
    ]) {
      expect(reduce(keyword)).toBe(keyword);
    }
  });

  test('maps garbage and a missing value to unknown', () => {
    expect(reduce('some free text that is not a url')).toBe('unknown');
    expect(reduce('')).toBe('unknown');
    expect(
      normalizeCspReportBody(legacy({ 'violated-directive': 'img-src' }))[0]
        ?.blockedUri,
    ).toBe('unknown');
  });
});

describe('normalizeCspReportBody — malformed input', () => {
  test('returns [] for a shape matching neither format', () => {
    expect(normalizeCspReportBody({ hello: 'world' })).toEqual([]);
  });

  test('returns [] for null, a string, or a number', () => {
    expect(normalizeCspReportBody(null)).toEqual([]);
    expect(normalizeCspReportBody('not json')).toEqual([]);
    expect(normalizeCspReportBody(42)).toEqual([]);
  });

  test('returns [] for a batch exceeding the 50-entry cap', () => {
    const oversized = Array.from({ length: 51 }, () =>
      reportingEntry({
        effectiveDirective: 'script-src',
        blockedURL: 'inline',
      }),
    );
    expect(normalizeCspReportBody(oversized)).toEqual([]);
  });
});
