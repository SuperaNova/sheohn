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

// Sliding-window limiter on the shared client; each route passes its own prefix and window.
export function createRateLimiter(
  prefix: string,
  tokens: number,
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
): Ratelimit {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix,
  });
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
