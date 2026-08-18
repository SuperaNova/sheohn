import { describe, expect, test } from 'vitest';
import {
  buildPingEntry,
  expectedStatusFor,
  isHealthyPing,
  parsePingEntry,
  PING_TARGETS,
} from './uptime-ping';

describe('buildPingEntry', () => {
  test('rounds latency and carries endpoint/status through', () => {
    const entry = buildPingEntry(
      { endpoint: 'home' },
      { status: 200, startedAtMs: 1000, finishedAtMs: 1042.6 },
    );
    expect(entry).toEqual({ ts: 1000, endpoint: 'home', ms: 43, status: 200 });
  });

  test('never returns negative latency', () => {
    const entry = buildPingEntry(
      { endpoint: 'home' },
      { status: 200, startedAtMs: 1000, finishedAtMs: 999 },
    );
    expect(entry.ms).toBe(0);
  });
});

describe('expectedStatusFor / isHealthyPing', () => {
  test('resolves the expected status for a known endpoint', () => {
    expect(expectedStatusFor('home')).toBe(200);
    expect(expectedStatusFor('chat')).toBe(404);
    expect(expectedStatusFor('contact')).toBe(404);
  });

  test('returns undefined for an unknown endpoint id', () => {
    expect(expectedStatusFor('nope')).toBeUndefined();
  });

  test('is healthy when status matches expected', () => {
    expect(isHealthyPing({ endpoint: 'home', status: 200 })).toBe(true);
    expect(isHealthyPing({ endpoint: 'chat', status: 404 })).toBe(true);
  });

  test('is unhealthy when status does not match expected', () => {
    expect(isHealthyPing({ endpoint: 'home', status: 500 })).toBe(false);
  });

  test('is unhealthy for an unknown endpoint (never crashes)', () => {
    expect(isHealthyPing({ endpoint: 'nope', status: 200 })).toBe(false);
  });
});

describe('parsePingEntry', () => {
  test('parses an already-deserialized object', () => {
    const raw = { ts: 1, endpoint: 'home', ms: 12, status: 200 };
    expect(parsePingEntry(raw)).toEqual(raw);
  });

  test('parses a raw JSON string', () => {
    const raw = JSON.stringify({
      ts: 1,
      endpoint: 'home',
      ms: 12,
      status: 200,
    });
    expect(parsePingEntry(raw)).toEqual({
      ts: 1,
      endpoint: 'home',
      ms: 12,
      status: 200,
    });
  });

  test('drops extra fields beyond the four stored ones', () => {
    const raw = { ts: 1, endpoint: 'home', ms: 12, status: 200, extra: 'x' };
    expect(parsePingEntry(raw)).toEqual({
      ts: 1,
      endpoint: 'home',
      ms: 12,
      status: 200,
    });
  });

  test('returns null for malformed JSON', () => {
    expect(parsePingEntry('not json{')).toBeNull();
  });

  test('returns null for missing fields', () => {
    expect(parsePingEntry({ ts: 1, endpoint: 'home' })).toBeNull();
  });

  test('returns null for non-object input', () => {
    expect(parsePingEntry(42)).toBeNull();
    expect(parsePingEntry(null)).toBeNull();
    expect(parsePingEntry(undefined)).toBeNull();
  });
});

describe('PING_TARGETS', () => {
  test('covers home, chat, and contact exactly once each', () => {
    const endpoints = PING_TARGETS.map((t) => t.endpoint).sort();
    expect(endpoints).toEqual(['chat', 'contact', 'home']);
  });
});
