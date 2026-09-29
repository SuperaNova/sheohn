// Redis persistence for CSP violation reports; own client, same env-var fallback as ratelimit.ts.
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

// Caps distinct directive+blockedUri pairs; repeats only bump a count, and a new pair at the
// cap evicts the least-recently-seen entry.
const MAX_DISTINCT_VIOLATIONS = 200;

// TTL refreshes on repeats; a one-off report ages out after 30 days.
const VIOLATION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Deterministic dedup key for a directive+blockedUri pair. */
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

/** Records a violation, deduped into one Redis hash with a count. Propagates Redis errors. */
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

/** Newest-first recent violations; returns [] on any Redis error so /status shows its empty state. */
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
