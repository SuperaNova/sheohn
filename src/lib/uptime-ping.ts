// Pure logic for the hourly uptime ping; scripts/ping-uptime.ts wraps it and status.astro renders it.

export interface PingTarget {
  /** Redis-safe identifier stored alongside each ping. */
  endpoint: string;
  path: string;
  method: 'GET';
  /** POST-only routes: Astro returns 404 (not 405) for GET, so no Gemini/Resend call runs. */
  expectedStatus: number;
}

export const PING_TARGETS: readonly PingTarget[] = [
  { endpoint: 'home', path: '/', method: 'GET', expectedStatus: 200 },
  {
    endpoint: 'chat',
    path: '/api/chat',
    method: 'GET',
    expectedStatus: 404,
  },
  {
    endpoint: 'contact',
    path: '/api/contact',
    method: 'GET',
    expectedStatus: 404,
  },
] as const;

/** Stored Redis record shape. */
export interface PingEntry {
  ts: number;
  endpoint: string;
  ms: number;
  status: number;
}

/** Builds the stored ping record from an observed fetch result. */
export function buildPingEntry(
  target: Pick<PingTarget, 'endpoint'>,
  observed: { status: number; startedAtMs: number; finishedAtMs: number },
): PingEntry {
  return {
    ts: Math.round(observed.startedAtMs),
    endpoint: target.endpoint,
    ms: Math.max(0, Math.round(observed.finishedAtMs - observed.startedAtMs)),
    status: observed.status,
  };
}

/** Looks up the expected status for a stored endpoint id, if still known. */
export function expectedStatusFor(endpoint: string): number | undefined {
  return PING_TARGETS.find((t) => t.endpoint === endpoint)?.expectedStatus;
}

/** A ping counts as healthy when its status matches the endpoint's expected value. */
export function isHealthyPing(
  entry: Pick<PingEntry, 'endpoint' | 'status'>,
): boolean {
  const expected = expectedStatusFor(entry.endpoint);
  return expected !== undefined && entry.status === expected;
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Parses a Redis list item (already-parsed object or JSON string) into a PingEntry; null if malformed. */
export function parsePingEntry(raw: unknown): PingEntry | null {
  const value = typeof raw === 'string' ? tryParseJson(raw) : raw;

  if (value === null || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.ts !== 'number' ||
    typeof candidate.endpoint !== 'string' ||
    typeof candidate.ms !== 'number' ||
    typeof candidate.status !== 'number'
  ) {
    return null;
  }

  return {
    ts: candidate.ts,
    endpoint: candidate.endpoint,
    ms: candidate.ms,
    status: candidate.status,
  };
}
