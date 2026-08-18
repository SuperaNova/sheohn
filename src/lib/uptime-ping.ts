// Pure logic for the hourly uptime ping; scripts/ping-uptime.ts wraps it for
// I/O and src/pages/status.astro reads PING_TARGETS/isHealthyPing to render.

export interface PingTarget {
  /** Redis-safe identifier stored alongside each ping. */
  endpoint: string;
  path: string;
  method: 'GET';
  /**
   * Both API routes are POST-only with no GET handler, so Astro returns 404
   * (not 405) for the undefined method — no Gemini/Resend call ever runs.
   */
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

/** Stored Redis record shape — kept to exactly these four fields. */
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

/**
 * Defensively parses a Redis list item back into a PingEntry. Tolerates
 * already-deserialized objects (Upstash auto-parses JSON list items) and raw
 * JSON strings, returning null for anything malformed rather than throwing.
 */
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
