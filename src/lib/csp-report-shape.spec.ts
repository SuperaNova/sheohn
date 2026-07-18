import { describe, expect, test } from 'vitest';
import { normalizeCspReportBody } from './csp-report-shape';

describe('normalizeCspReportBody — legacy report-uri shape', () => {
  test('extracts directive and blockedUri from a single csp-report object', () => {
    expect(
      normalizeCspReportBody({
        'csp-report': {
          'document-uri': 'https://sheohn.dev/',
          'violated-directive': 'script-src',
          'blocked-uri': 'https://evil.example.com/x.js',
        },
      }),
    ).toEqual([
      { directive: 'script-src', blockedUri: 'https://evil.example.com/x.js' },
    ]);
  });

  test('prefers effective-directive over violated-directive when both present', () => {
    expect(
      normalizeCspReportBody({
        'csp-report': {
          'violated-directive': 'script-src 2.0',
          'effective-directive': 'script-src',
          'blocked-uri': 'inline',
        },
      }),
    ).toEqual([{ directive: 'script-src', blockedUri: 'inline' }]);
  });

  test('falls back to "unknown" for missing fields', () => {
    expect(normalizeCspReportBody({ 'csp-report': {} })).toEqual([
      { directive: 'unknown', blockedUri: 'unknown' },
    ]);
  });
});

describe('normalizeCspReportBody — Reporting API report-to shape', () => {
  test('extracts every entry from a batch array', () => {
    expect(
      normalizeCspReportBody([
        {
          type: 'csp-violation',
          body: {
            effectiveDirective: 'style-src',
            blockedURL: 'https://evil.example.com/x.css',
          },
        },
        {
          type: 'csp-violation',
          body: { effectiveDirective: 'img-src', blockedURL: 'inline' },
        },
      ]),
    ).toEqual([
      { directive: 'style-src', blockedUri: 'https://evil.example.com/x.css' },
      { directive: 'img-src', blockedUri: 'inline' },
    ]);
  });

  test('falls back to the legacy blockedURI field name', () => {
    expect(
      normalizeCspReportBody([
        {
          type: 'csp-violation',
          body: { effectiveDirective: 'script-src', blockedURI: 'eval' },
        },
      ]),
    ).toEqual([{ directive: 'script-src', blockedUri: 'eval' }]);
  });

  test('filters out non-csp-violation report types in the same batch', () => {
    expect(
      normalizeCspReportBody([
        { type: 'deprecation', body: {} },
        {
          type: 'csp-violation',
          body: { effectiveDirective: 'connect-src', blockedURL: 'wss://x' },
        },
      ]),
    ).toEqual([{ directive: 'connect-src', blockedUri: 'wss://x' }]);
  });

  test('accepts an entry with no type field at all', () => {
    expect(
      normalizeCspReportBody([
        { body: { effectiveDirective: 'font-src', blockedURL: 'data:' } },
      ]),
    ).toEqual([{ directive: 'font-src', blockedUri: 'data:' }]);
  });
});

describe('normalizeCspReportBody — length caps', () => {
  test('truncates an over-long directive to 200 chars', () => {
    const longDirective = 'x'.repeat(5000);
    const [result] = normalizeCspReportBody({
      'csp-report': {
        'violated-directive': longDirective,
        'blocked-uri': 'inline',
      },
    });
    expect(result?.directive).toHaveLength(200);
    expect(result?.directive).toBe(longDirective.slice(0, 200));
  });

  test('truncates an over-long blockedUri to 500 chars', () => {
    const longUri = `https://evil.example.com/${'y'.repeat(5000)}`;
    const [result] = normalizeCspReportBody([
      {
        type: 'csp-violation',
        body: { effectiveDirective: 'script-src', blockedURL: longUri },
      },
    ]);
    expect(result?.blockedUri).toHaveLength(500);
    expect(result?.blockedUri).toBe(longUri.slice(0, 500));
  });

  test('two over-long blockedUris identical within the cap normalize to the same value', () => {
    const shared = 'z'.repeat(500);
    const a = normalizeCspReportBody({
      'csp-report': {
        'violated-directive': 'script-src',
        'blocked-uri': shared + 'TAIL-A',
      },
    })[0];
    const b = normalizeCspReportBody({
      'csp-report': {
        'violated-directive': 'script-src',
        'blocked-uri': shared + 'TAIL-B',
      },
    })[0];
    // Both tails are past the 500-char cap, so both normalize identically —
    // this is exactly what makes them dedupe to one Redis entry downstream.
    expect(a?.blockedUri).toBe(b?.blockedUri);
    expect(a?.blockedUri).toHaveLength(500);
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
    const oversized = Array.from({ length: 51 }, () => ({
      type: 'csp-violation',
      body: { effectiveDirective: 'script-src', blockedURL: 'x' },
    }));
    expect(normalizeCspReportBody(oversized)).toEqual([]);
  });
});
