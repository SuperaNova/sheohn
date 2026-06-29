import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Shared Upstash Redis client. Built once at module load so it caches across
// invocations on the serverless function. import.meta.env is read first for
// Astro SSR; process.env is the runtime fallback.
const redis = new Redis({
  url:
    import.meta.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_URL,
  token:
    import.meta.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Build a sliding-window rate limiter on the shared Redis client. Each route
// passes its own prefix + window so the counters stay isolated per endpoint.
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
