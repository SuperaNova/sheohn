// Redis persistence for the RUM collector. Same env-var-fallback pattern as
// src/lib/ratelimit.ts; a second client instance here keeps that module's
// exports untouched.
import { Redis } from '@upstash/redis';
import {
  bucketFor,
  estimatePercentiles,
  type MetricKind,
  type Percentiles,
} from './rum-metrics';

const redis = new Redis({
  url:
    import.meta.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_URL,
  token:
    import.meta.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TTL_SECONDS = 90 * 24 * 60 * 60;
const STATS_WINDOW_DAYS = 14;

function bucketsKey(route: string, date: string): string {
  return `rum:${route}:${date}`;
}

function pageviewKey(route: string, date: string): string {
  return `rum:pageviews:${route}:${date}`;
}

export function utcDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function recentDates(days: number, from: Date = new Date()): string[] {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(utcDateString(d));
  }
  return dates;
}

interface RecordVitalInput {
  route: string;
  metric: MetricKind;
  value: number;
  date: string;
}

/**
 * Increments the route/day hash bucket for one metric sample. TTL is
 * refreshed on every write, but since each key is scoped to a single
 * calendar day, writes to it only ever happen within that day — so this
 * only extends the window from the day's last write, never resurrects a
 * key across days.
 */
export async function recordVital({
  route,
  metric,
  value,
  date,
}: RecordVitalInput): Promise<void> {
  const key = bucketsKey(route, date);
  const field = `${metric}:${bucketFor(metric, value)}`;
  await redis.pipeline().hincrby(key, field, 1).expire(key, TTL_SECONDS).exec();
}

export async function recordPageview({
  route,
  date,
}: {
  route: string;
  date: string;
}): Promise<void> {
  const key = pageviewKey(route, date);
  await redis.pipeline().incr(key).expire(key, TTL_SECONDS).exec();
}

export interface RouteStats {
  pageviews: number;
  percentiles: Record<MetricKind, Percentiles>;
}

const EMPTY_PERCENTILES: Percentiles = { p50: 0, p75: 0, p95: 0 };
const EMPTY_STATS: RouteStats = {
  pageviews: 0,
  percentiles: {
    lcp: EMPTY_PERCENTILES,
    cls: EMPTY_PERCENTILES,
    inp: EMPTY_PERCENTILES,
  },
};

function metricBuckets(
  merged: Record<string, number>,
  metric: MetricKind,
): Record<string, number> {
  const prefix = `${metric}:`;
  const out: Record<string, number> = {};
  for (const [field, count] of Object.entries(merged)) {
    if (field.startsWith(prefix)) out[field.slice(prefix.length)] = count;
  }
  return out;
}

/**
 * Reads pageviews + estimated p50/p75/p95 for a route over the trailing
 * STATS_WINDOW_DAYS. One pipelined round trip per route regardless of window
 * size. Fails open — returns zeroed-out stats — so /stats never 500s on an
 * unreachable or empty Redis.
 */
export async function getRouteStats(route: string): Promise<RouteStats> {
  try {
    const dates = recentDates(STATS_WINDOW_DAYS);
    const pipeline = redis.pipeline();
    for (const date of dates) {
      pipeline.get(pageviewKey(route, date));
      pipeline.hgetall(bucketsKey(route, date));
    }
    const results = await pipeline.exec<unknown[]>();

    let pageviews = 0;
    const merged: Record<string, number> = {};
    for (let i = 0; i < dates.length; i++) {
      const pv = results[i * 2] as number | null;
      const hash = results[i * 2 + 1] as Record<string, unknown> | null;
      pageviews += pv ?? 0;
      if (hash) {
        for (const [field, count] of Object.entries(hash)) {
          merged[field] = (merged[field] ?? 0) + Number(count);
        }
      }
    }

    return {
      pageviews,
      percentiles: {
        lcp: estimatePercentiles(metricBuckets(merged, 'lcp'), 'lcp'),
        cls: estimatePercentiles(metricBuckets(merged, 'cls'), 'cls'),
        inp: estimatePercentiles(metricBuckets(merged, 'inp'), 'inp'),
      },
    };
  } catch (err) {
    console.error('[rum-redis] getRouteStats failed — failing open:', err);
    return EMPTY_STATS;
  }
}
