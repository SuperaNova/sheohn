import { describe, expect, test } from 'vitest';
import { isDeclaredBodyTooLarge } from './body-limit';

describe('isDeclaredBodyTooLarge', () => {
  test('is false when the header is absent or unparseable', () => {
    expect(isDeclaredBodyTooLarge(null, 100)).toBe(false);
    expect(isDeclaredBodyTooLarge('abc', 100)).toBe(false);
  });

  test('is false at the cap and true one byte above it', () => {
    expect(isDeclaredBodyTooLarge('100', 100)).toBe(false);
    expect(isDeclaredBodyTooLarge('101', 100)).toBe(true);
  });
});
