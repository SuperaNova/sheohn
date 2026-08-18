// Pure histogram bucket/percentile math for the RUM collector — no Redis,
// Astro, or browser imports, so it's usable from both the API route and
// server-side stats rendering, and trivially unit-testable.

export type MetricKind = 'lcp' | 'cls' | 'inp';

export interface BucketBoundary {
  /** Inclusive lower bound, in the metric's bucketing unit. */
  min: number;
  /** Exclusive upper bound; Infinity for the open-ended top bucket. */
  max: number;
  label: string;
}

export interface Percentiles {
  p50: number;
  p75: number;
  p95: number;
}

// Boundaries roughly track Google's Core Web Vitals good/needs-improvement/poor
// cutoffs (LCP 2500/4000ms, INP 200/500ms, CLS 0.1/0.25), plus one extra split
// for a "very poor" tail bucket. CLS is bucketed on score*1000 so bucket keys
// stay integers.
const LCP_BOUNDARIES: BucketBoundary[] = [
  { min: 0, max: 1000, label: '0-1000' },
  { min: 1000, max: 2500, label: '1000-2500' },
  { min: 2500, max: 4000, label: '2500-4000' },
  { min: 4000, max: Infinity, label: '4000+' },
];

const INP_BOUNDARIES: BucketBoundary[] = [
  { min: 0, max: 200, label: '0-200' },
  { min: 200, max: 500, label: '200-500' },
  { min: 500, max: 1000, label: '500-1000' },
  { min: 1000, max: Infinity, label: '1000+' },
];

const CLS_BOUNDARIES: BucketBoundary[] = [
  { min: 0, max: 100, label: '0-100' },
  { min: 100, max: 250, label: '100-250' },
  { min: 250, max: 500, label: '250-500' },
  { min: 500, max: Infinity, label: '500+' },
];

export function boundariesFor(metric: MetricKind): BucketBoundary[] {
  if (metric === 'lcp') return LCP_BOUNDARIES;
  if (metric === 'inp') return INP_BOUNDARIES;
  return CLS_BOUNDARIES;
}

function scaleValue(metric: MetricKind, value: number): number {
  return metric === 'cls' ? value * 1000 : value;
}

/** Maps a raw metric value (ms for lcp/inp, unitless score for cls) to its bucket label. */
export function bucketFor(metric: MetricKind, value: number): string {
  const scaled = scaleValue(metric, value);
  const boundaries = boundariesFor(metric);
  let lastLabel = '';
  for (const b of boundaries) {
    lastLabel = b.label;
    if (scaled >= b.min && scaled < b.max) return b.label;
  }
  return lastLabel;
}

/**
 * Estimates a percentile from bucket counts: walks boundaries in order,
 * accumulating counts until crossing `percentile * total`, then interpolates
 * linearly within that bucket's range. The open-ended top bucket can't be
 * interpolated past Infinity, so a value landing there returns the bucket's
 * floor (an intentional undercount, not a fabricated ceiling).
 */
export function estimatePercentile(
  buckets: Record<string, number>,
  boundaries: BucketBoundary[],
  percentile: number,
): number {
  const total = boundaries.reduce((sum, b) => sum + (buckets[b.label] ?? 0), 0);
  if (total === 0) return 0;

  const target = percentile * total;
  let cumulative = 0;
  let lastMin = 0;
  for (const b of boundaries) {
    lastMin = b.min;
    const count = buckets[b.label] ?? 0;
    const nextCumulative = cumulative + count;
    if (target <= nextCumulative) {
      if (!Number.isFinite(b.max)) return b.min;
      const fraction = count === 0 ? 0 : (target - cumulative) / count;
      return b.min + fraction * (b.max - b.min);
    }
    cumulative = nextCumulative;
  }
  return lastMin;
}

/** p50/p75/p95 for one metric, rescaled back to real-world units (cls divided back out of *1000). */
export function estimatePercentiles(
  buckets: Record<string, number>,
  metric: MetricKind,
): Percentiles {
  const boundaries = boundariesFor(metric);
  const descale = (v: number) => (metric === 'cls' ? v / 1000 : v);
  return {
    p50: descale(estimatePercentile(buckets, boundaries, 0.5)),
    p75: descale(estimatePercentile(buckets, boundaries, 0.75)),
    p95: descale(estimatePercentile(buckets, boundaries, 0.95)),
  };
}
