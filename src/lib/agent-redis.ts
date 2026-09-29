// Redis persistence for /api/chat telemetry, under the `agent:` key namespace.
// record* functions never reject, so callers can fire-and-forget them.
import { Redis } from '@upstash/redis';
import { recentDates, utcDateString } from './rum-redis';
import {
  buildAgentStats,
  EMPTY_AGENT_STATS,
  isAgentToolName,
  latencyBucketFor,
  type AgentStats,
} from './agent-metrics';

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

function requestsKey(date: string): string {
  return `agent:requests:${date}`;
}

function toolsKey(date: string): string {
  return `agent:tools:${date}`;
}

function latencyKey(date: string): string {
  return `agent:latency:${date}`;
}

function cacheKey(date: string): string {
  return `agent:cache:${date}`;
}

/** One request to the route, and whether the rate limiter throttled it. */
export async function recordAgentRequest(rejected: boolean): Promise<void> {
  try {
    const key = requestsKey(utcDateString());
    const pipeline = redis.pipeline().hincrby(key, 'total', 1);
    if (rejected) pipeline.hincrby(key, 'rejected', 1);
    pipeline.expire(key, TTL_SECONDS);
    await pipeline.exec();
  } catch (err) {
    console.error('[agent-redis] recordAgentRequest failed — dropping:', err);
  }
}

/** One completed turn's latency and tool calls; unknown tool names are dropped. */
export async function recordAgentTurn({
  durationMs,
  toolNames,
}: {
  durationMs: number;
  toolNames: string[];
}): Promise<void> {
  try {
    const date = utcDateString();
    const pipeline = redis.pipeline();

    const lKey = latencyKey(date);
    pipeline.hincrby(lKey, latencyBucketFor(durationMs), 1);
    pipeline.expire(lKey, TTL_SECONDS);

    const knownTools = toolNames.filter(isAgentToolName);
    if (knownTools.length > 0) {
      const tKey = toolsKey(date);
      for (const name of knownTools) pipeline.hincrby(tKey, name, 1);
      pipeline.expire(tKey, TTL_SECONDS);
    }

    await pipeline.exec();
  } catch (err) {
    console.error('[agent-redis] recordAgentTurn failed — dropping:', err);
  }
}

/** One query_jared_memory lookup's ragCache result. */
export async function recordAgentCacheEvent(
  kind: 'hit' | 'miss',
): Promise<void> {
  try {
    const key = cacheKey(utcDateString());
    await redis
      .pipeline()
      .hincrby(key, kind, 1)
      .expire(key, TTL_SECONDS)
      .exec();
  } catch (err) {
    console.error(
      '[agent-redis] recordAgentCacheEvent failed — dropping:',
      err,
    );
  }
}

/** Merges all metrics over the trailing STATS_WINDOW_DAYS; fails open to zeroed stats. */
export async function getAgentStats(): Promise<AgentStats> {
  try {
    const dates = recentDates(STATS_WINDOW_DAYS);
    const pipeline = redis.pipeline();
    for (const date of dates) {
      pipeline.hgetall(requestsKey(date));
      pipeline.hgetall(toolsKey(date));
      pipeline.hgetall(latencyKey(date));
      pipeline.hgetall(cacheKey(date));
    }
    const results = await pipeline.exec<unknown[]>();

    let totalRequests = 0;
    let rejectedRequests = 0;
    const toolCounts: Record<string, number> = {};
    const latencyBuckets: Record<string, number> = {};
    let cacheHits = 0;
    let cacheMisses = 0;

    for (let i = 0; i < dates.length; i++) {
      const requests = results[i * 4] as Record<string, unknown> | null;
      const tools = results[i * 4 + 1] as Record<string, unknown> | null;
      const latency = results[i * 4 + 2] as Record<string, unknown> | null;
      const cache = results[i * 4 + 3] as Record<string, unknown> | null;

      if (requests) {
        totalRequests += Number(requests.total ?? 0);
        rejectedRequests += Number(requests.rejected ?? 0);
      }
      if (tools) {
        for (const [name, count] of Object.entries(tools)) {
          toolCounts[name] = (toolCounts[name] ?? 0) + Number(count);
        }
      }
      if (latency) {
        for (const [bucket, count] of Object.entries(latency)) {
          latencyBuckets[bucket] =
            (latencyBuckets[bucket] ?? 0) + Number(count);
        }
      }
      if (cache) {
        cacheHits += Number(cache.hit ?? 0);
        cacheMisses += Number(cache.miss ?? 0);
      }
    }

    return buildAgentStats({
      totalRequests,
      rejectedRequests,
      toolCounts,
      latencyBuckets,
      cacheHits,
      cacheMisses,
    });
  } catch (err) {
    console.error('[agent-redis] getAgentStats failed — failing open:', err);
    return EMPTY_AGENT_STATS;
  }
}
