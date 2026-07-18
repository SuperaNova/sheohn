import { describe, expect, test } from 'vitest';
import {
  boundariesFor,
  bucketFor,
  estimatePercentile,
  estimatePercentiles,
} from './rum-metrics';

describe('bucketFor', () => {
  test('buckets lcp at boundary edges', () => {
    expect(bucketFor('lcp', 0)).toBe('0-1000');
    expect(bucketFor('lcp', 999)).toBe('0-1000');
    expect(bucketFor('lcp', 1000)).toBe('1000-2500');
    expect(bucketFor('lcp', 2500)).toBe('2500-4000');
    expect(bucketFor('lcp', 4000)).toBe('4000+');
    expect(bucketFor('lcp', 999_999)).toBe('4000+');
  });

  test('buckets inp at boundary edges', () => {
    expect(bucketFor('inp', 199)).toBe('0-200');
    expect(bucketFor('inp', 200)).toBe('200-500');
    expect(bucketFor('inp', 500)).toBe('500-1000');
    expect(bucketFor('inp', 1000)).toBe('1000+');
  });

  test('buckets cls by scaling the raw score x1000', () => {
    expect(bucketFor('cls', 0)).toBe('0-100');
    expect(bucketFor('cls', 0.099)).toBe('0-100');
    expect(bucketFor('cls', 0.1)).toBe('100-250');
    expect(bucketFor('cls', 0.25)).toBe('250-500');
    expect(bucketFor('cls', 0.6)).toBe('500+');
  });
});

describe('estimatePercentile', () => {
  test('estimates p50/p75/p95 of a uniform distribution across 10 buckets', () => {
    const boundaries = Array.from({ length: 10 }, (_, i) => ({
      min: i * 10,
      max: (i + 1) * 10,
      label: String(i),
    }));
    const buckets = Object.fromEntries(boundaries.map((b) => [b.label, 1]));

    expect(estimatePercentile(buckets, boundaries, 0.5)).toBeCloseTo(50);
    expect(estimatePercentile(buckets, boundaries, 0.75)).toBeCloseTo(75);
    expect(estimatePercentile(buckets, boundaries, 0.95)).toBeCloseTo(95);
  });

  test('returns 0 for an empty histogram', () => {
    const boundaries = boundariesFor('lcp');
    expect(estimatePercentile({}, boundaries, 0.5)).toBe(0);
  });

  test('returns the bucket floor when the percentile lands in the open-ended top bucket', () => {
    const boundaries = boundariesFor('lcp');
    const buckets = { '4000+': 10 };
    expect(estimatePercentile(buckets, boundaries, 0.95)).toBe(4000);
  });

  test('interpolates within a single populated bucket', () => {
    const boundaries = boundariesFor('inp');
    const buckets = { '200-500': 4 };
    // 4 samples spread evenly across [200,500): p50 falls halfway through.
    expect(estimatePercentile(buckets, boundaries, 0.5)).toBeCloseTo(350);
  });
});

describe('estimatePercentiles', () => {
  test('rescales cls percentiles back out of the x1000 bucketing unit', () => {
    const buckets = { '0-100': 5, '100-250': 5 };
    const result = estimatePercentiles(buckets, 'cls');
    expect(result.p50).toBeLessThan(1);
    expect(result.p50).toBeCloseTo(0.1);
  });

  test('leaves lcp/inp in millisecond units', () => {
    const buckets = { '0-1000': 5, '1000-2500': 5 };
    const result = estimatePercentiles(buckets, 'lcp');
    expect(result.p50).toBeCloseTo(1000);
  });
});
