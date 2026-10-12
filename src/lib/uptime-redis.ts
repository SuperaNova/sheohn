// Upstash Redis client for uptime ping history; own client, same env-var fallback as ratelimit.ts.
import { Redis } from '@upstash/redis';
import { parsePingEntry, type PingEntry } from './uptime-ping';

// Also imported by scripts/ping-uptime.ts under plain Node, where import.meta.env is undefined,
// so read it defensively before falling back to process.env.
const metaEnv = (
  import.meta as ImportMeta & { env?: Record<string, string | undefined> }
).env;

const redis = new Redis({
  url: metaEnv?.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL,
  token:
    metaEnv?.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const PINGS_KEY = 'uptime:pings';
// Hourly cron x 3 endpoints/run keeps ~1 week of history in 500 entries.
const MAX_PINGS = 500;

/** Pushes a ping and trims the list, capping it at MAX_PINGS entries. */
export async function recordPing(entry: PingEntry): Promise<void> {
  await redis.lpush<PingEntry>(PINGS_KEY, entry);
  await redis.ltrim(PINGS_KEY, 0, MAX_PINGS - 1);
}

/** Newest-first recent pings; returns [] on any Redis error so /status shows its empty state. */
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
