import { describe, expect, test } from 'vitest';
import { buildSparklinePoints } from './sparkline';

describe('buildSparklinePoints', () => {
  test('returns an empty string for an empty series', () => {
    expect(buildSparklinePoints([])).toBe('');
  });

  test('renders a single value as a flat line spanning the full width', () => {
    const points = buildSparklinePoints([42], {
      width: 100,
      height: 40,
      padding: 4,
    });
    expect(points).toBe('4,20 96,20');
  });

  test('renders an all-equal series as a flat mid-height line', () => {
    const points = buildSparklinePoints([10, 10, 10], {
      width: 100,
      height: 40,
      padding: 4,
    });
    expect(points).toBe('4,20 50,20 96,20');
  });

  test('higher values render at a smaller y (higher on the chart)', () => {
    const points = buildSparklinePoints([0, 100], {
      width: 100,
      height: 40,
      padding: 0,
    });
    const [firstY, secondY] = points
      .split(' ')
      .map((p) => Number(p.split(',')[1]));
    expect(firstY!).toBeGreaterThan(secondY!);
  });

  test('x coordinates are monotonically increasing across the series', () => {
    const points = buildSparklinePoints([3, 1, 4, 1, 5], { width: 200 })
      .split(' ')
      .map((p) => Number(p.split(',')[0]));
    for (let i = 1; i < points.length; i++) {
      expect(points[i]).toBeGreaterThan(points[i - 1]!);
    }
  });

  test('respects custom dimensions', () => {
    const points = buildSparklinePoints([1, 2], {
      width: 400,
      height: 100,
      padding: 10,
    });
    const xs = points.split(' ').map((p) => Number(p.split(',')[0]));
    expect(xs[0]).toBe(10);
    expect(xs[1]).toBe(390);
  });
});
