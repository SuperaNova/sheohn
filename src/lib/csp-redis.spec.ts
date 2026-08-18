import { describe, expect, test } from 'vitest';
import { buildViolationKey } from './csp-redis';

// Pure key-building/dedup logic only — recordViolation/getRecentViolations
// need a live Redis and are exercised manually (see the spec's acceptance
// steps), not here.
describe('buildViolationKey', () => {
  test('is deterministic for the same directive+blockedUri pair', () => {
    const a = buildViolationKey('script-src', 'https://evil.example.com/x.js');
    const b = buildViolationKey('script-src', 'https://evil.example.com/x.js');
    expect(a).toBe(b);
  });

  test('differs when the directive differs', () => {
    expect(buildViolationKey('script-src', 'inline')).not.toBe(
      buildViolationKey('style-src', 'inline'),
    );
  });

  test('differs when the blockedUri differs', () => {
    expect(buildViolationKey('script-src', 'https://a.example.com')).not.toBe(
      buildViolationKey('script-src', 'https://b.example.com'),
    );
  });

  test('is a 16-character lowercase hex string', () => {
    expect(buildViolationKey('script-src', 'eval')).toMatch(/^[0-9a-f]{16}$/);
  });

  test('does not collide on naive concatenation across the delimiter', () => {
    // Without a delimiter, ("script-src", "Xy") and ("script-sr", "cXy")
    // would concatenate identically. Confirms the two are still distinct.
    expect(buildViolationKey('script-src', 'Xy')).not.toBe(
      buildViolationKey('script-sr', 'cXy'),
    );
  });
});
