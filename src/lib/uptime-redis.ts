// Upstash Redis client for the uptime ping history. Same env-var-fallback
// pattern as src/lib/ratelimit.ts; a second client instance here keeps that
// module's export surface untouched.
import { Redis } from '@upstash/redis';
import { parsePingEntry, type PingEntry } from './uptime-ping';

const redis = new Redis({
  url:
    import.meta.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_URL,
  token:
    import.meta.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN,
});

const PINGS_KEY = 'uptime:pings';
// Hourly cron x 3 endpoints/run keeps ~1 week of history in 500 entries.
const MAX_PINGS = 500;

/** Pushes a ping and trims the list, capping it at MAX_PINGS entries. */
export async function recordPing(entry: PingEntry): Promise<void> {
  await redis.lpush<PingEntry>(PINGS_KEY, entry);
  await redis.ltrim(PINGS_KEY, 0, MAX_PINGS - 1);
}

/**
 * Reads the most recent pings (newest first). Fails open — returns [] on
 * any Redis error — so /status renders its empty state instead of crashing.
 */
export async function getRecentPings(limit = 150): Promise<PingEntry[]> {
  try {
    const raw = await redis.lrange<unknown>(PINGS_KEY, 0, limit - 1);
    return raw
      .map((item) => parsePingEntry(item))
      .filter((entry): entry is PingEntry => entry !== null);
  } catch (err) {
    console.error('[uptime-redis] getRecentPings failed — failing open:', err);
    return [];
  }
}
