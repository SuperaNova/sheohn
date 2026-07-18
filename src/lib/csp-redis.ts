// Redis persistence for CSP violation reports. Same env-var-fallback client
// pattern as src/lib/ratelimit.ts; a second client instance here keeps that
// module's exports untouched.
import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import type { NormalizedViolation } from './csp-report-shape';

const redis = new Redis({
  url:
    import.meta.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_URL,
  token:
    import.meta.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN,
});

const VIOLATION_KEY_PREFIX = 'csp:violation:';
const INDEX_KEY = 'csp:violations:index';
const UNKNOWN = 'unknown';

// Caps the number of DISTINCT directive+blockedUri pairs tracked at once —
// repeat reports of an already-tracked pair only bump its count, they never
// grow this total. When a genuinely new pair arrives at the cap, the
// least-recently-seen entry (lowest score in the index) is evicted first.
const MAX_DISTINCT_VIOLATIONS = 200;

// TTL refreshes on every repeat occurrence, so an actively-recurring
// violation stays visible; a one-off report ages out after 30 days.
const VIOLATION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Deterministic dedup key for a directive+blockedUri pair. Pure — no IO. */
export function buildViolationKey(
  directive: string,
  blockedUri: string,
): string {
  return createHash('sha256')
    .update(`${directive}|${blockedUri}`)
    .digest('hex')
    .slice(0, 16);
}

export interface ViolationEntry {
  directive: string;
  blockedUri: string;
  count: number;
  lastSeen: number;
}

/**
 * Records one violation occurrence, deduped by directive+blockedUri into a
 * single Redis hash with an incrementing count. Propagates Redis errors —
 * the caller (the API route) decides how to respond; CSP reporting never
 * inspects the response body either way.
 */
export async function recordViolation(
  entry: NormalizedViolation,
): Promise<void> {
  const dedupKey = buildViolationKey(entry.directive, entry.blockedUri);
  const violationKey = `${VIOLATION_KEY_PREFIX}${dedupKey}`;
  const now = Date.now();

  const isNew = (await redis.zscore(INDEX_KEY, dedupKey)) === null;
  if (isNew && (await redis.zcard(INDEX_KEY)) >= MAX_DISTINCT_VIOLATIONS) {
    const [oldest] = await redis.zrange<string[]>(INDEX_KEY, 0, 0);
    if (oldest) {
      await redis
        .pipeline()
        .zrem(INDEX_KEY, oldest)
        .del(`${VIOLATION_KEY_PREFIX}${oldest}`)
        .exec();
    }
  }

  await redis
    .pipeline()
    .hset(violationKey, {
      directive: entry.directive,
      blockedUri: entry.blockedUri,
      lastSeen: now,
    })
    .hincrby(violationKey, 'count', 1)
    .expire(violationKey, VIOLATION_TTL_SECONDS)
    .zadd(INDEX_KEY, { score: now, member: dedupKey })
    .expire(INDEX_KEY, VIOLATION_TTL_SECONDS)
    .exec();
}

/**
 * Reads the most recently active violations (newest last-seen first). Fails
 * open — returns [] on any Redis error — so /status renders its empty state
 * instead of crashing.
 */
export async function getRecentViolations(
  limit = 20,
): Promise<ViolationEntry[]> {
  try {
    const dedupKeys = await redis.zrange<string[]>(INDEX_KEY, 0, limit - 1, {
      rev: true,
    });
    if (dedupKeys.length === 0) return [];

    const pipeline = redis.pipeline();
    for (const key of dedupKeys) {
      pipeline.hgetall(`${VIOLATION_KEY_PREFIX}${key}`);
    }
    const results = await pipeline.exec<(Record<string, unknown> | null)[]>();

    return results
      .filter((r): r is Record<string, unknown> => !!r)
      .map((r) => ({
        directive: String(r.directive ?? UNKNOWN),
        blockedUri: String(r.blockedUri ?? UNKNOWN),
        count: Number(r.count ?? 0),
        lastSeen: Number(r.lastSeen ?? 0),
      }));
  } catch (err) {
    console.error(
      '[csp-redis] getRecentViolations failed — failing open:',
      err,
    );
    return [];
  }
}
