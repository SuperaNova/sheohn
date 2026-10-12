import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Shared Upstash Redis client, built once at module load; import.meta.env first (Astro SSR),
// process.env as the runtime fallback.
const redis = new Redis({
  url:
    import.meta.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_URL,
  token:
    import.meta.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN,
});

const KILL_SWITCH_KEY = 'agent:killswitch';

// Sliding-window limiter on the shared client; each route passes its own prefix and window.
// `fixed` aligns windows to the clock (a '1 d' window resets at UTC midnight).
export function createRateLimiter(
  prefix: string,
  tokens: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
  algorithm: 'sliding' | 'fixed' = 'sliding',
): Ratelimit {
  return new Ratelimit({
    redis,
    limiter:
      algorithm === 'fixed'
        ? Ratelimit.fixedWindow(tokens, window)
        : Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix,
  });
}

// One GET; fails OPEN (reads as unset) so a Redis outage can't take chat down.
export async function readKillSwitch(): Promise<unknown> {
  try {
    return await redis.get(KILL_SWITCH_KEY);
  } catch (err) {
    console.error('[ratelimit] kill-switch read failed — failing open:', err);
    return null;
  }
}

// Fails OPEN on infrastructure errors: throttling is a guard, not a dependency.
export async function safeLimit(
  limiter: Ratelimit,
  key: string,
): Promise<Awaited<ReturnType<Ratelimit['limit']>> | null> {
  try {
    return await limiter.limit(key);
  } catch (err) {
    console.error('[ratelimit] limit check failed — failing open:', err);
    return null;
  }
}
