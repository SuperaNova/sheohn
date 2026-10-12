// CLI wrapper over src/lib/uptime-ping.ts and uptime-redis.ts: pings each PING_TARGET on a live
// host and records latency/status to Upstash Redis.
// Usage: npx tsx scripts/ping-uptime.ts
//   - Host defaults to https://sheohn.dev; override with $UPTIME_TARGET_BASE_URL.
//   - Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from process.env.
import 'dotenv/config';
import {
  buildPingEntry,
  PING_TARGETS,
  type PingTarget,
} from '../src/lib/uptime-ping';
import { recordPing } from '../src/lib/uptime-redis';

const BASE_URL = process.env.UPTIME_TARGET_BASE_URL ?? 'https://sheohn.dev';
const REQUEST_TIMEOUT_MS = 10_000;

async function pingOne(target: PingTarget): Promise<void> {
  const url = new URL(target.path, BASE_URL).toString();
  const startedAtMs = Date.now();
  let status: number;

  try {
    const response = await fetch(url, {
      method: target.method,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    status = response.status;
  } catch (err) {
    // Network error or timeout: 0 is not a real status, so it always reads as unhealthy.
    console.error(`[ping-uptime] ${target.endpoint} (${url}) failed:`, err);
    status = 0;
  }

  const finishedAtMs = Date.now();
  const entry = buildPingEntry(target, { status, startedAtMs, finishedAtMs });
  await recordPing(entry);

  console.log(
    `[ping-uptime] ${target.endpoint} -> ${entry.status} in ${entry.ms}ms (expected ${target.expectedStatus})`,
  );
}

async function main(): Promise<void> {
  for (const target of PING_TARGETS) {
    await pingOne(target);
  }
}

main().catch((err) => {
  console.error('[ping-uptime] fatal error:', err);
  process.exit(1);
});
