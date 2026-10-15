// Pure admission logic for /mcp; request metadata and limiter I/O are injected so it stays testable.
import { isKillSwitchOn, secondsUntil, type LimitOutcome } from './chat-guard';

export const MCP_MAX_BODY_BYTES = 16_384;

const ALLOWED_ORIGINS: readonly string[] = [
  'https://sheohn.dev',
  'https://www.sheohn.dev',
];
const DEV_ORIGIN_PATTERN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

type McpRejectionReason =
  | 'forbidden_origin'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'rate_limited'
  | 'offline';

export type McpAdmission =
  | { admit: true; body: string }
  | {
      admit: false;
      reason: McpRejectionReason;
      status: 403 | 413 | 415 | 429 | 503;
      retryAfterSeconds?: number;
    };

function isOriginAllowed(origin: string, isDev: boolean): boolean {
  return (
    ALLOWED_ORIGINS.includes(origin) ||
    (isDev && DEV_ORIGIN_PATTERN.test(origin))
  );
}

/**
 * Runs the guards in order and stops at the first rejection, so a rejected request never
 * spends a later guard's budget. A null limiter result means the check failed open.
 */
export async function decideMcpAdmission(
  request: { origin: string | null; contentType: string | null },
  checks: {
    isDev: boolean;
    readBody: () => Promise<string>;
    limitIp: () => Promise<LimitOutcome | null>;
    readKillSwitch: () => Promise<unknown>;
    now?: () => number;
  },
): Promise<McpAdmission> {
  const nowMs = (checks.now ?? Date.now)();

  if (
    request.origin !== null &&
    !isOriginAllowed(request.origin, checks.isDev)
  ) {
    return { admit: false, reason: 'forbidden_origin', status: 403 };
  }

  if (!(request.contentType ?? '').includes('application/json')) {
    return { admit: false, reason: 'unsupported_media_type', status: 415 };
  }

  const body = await checks.readBody();
  if (new TextEncoder().encode(body).byteLength > MCP_MAX_BODY_BYTES) {
    return { admit: false, reason: 'payload_too_large', status: 413 };
  }

  const ipLimit = await checks.limitIp();
  if (ipLimit && !ipLimit.success) {
    return {
      admit: false,
      reason: 'rate_limited',
      status: 429,
      retryAfterSeconds: secondsUntil(ipLimit.reset, nowMs),
    };
  }

  if (isKillSwitchOn(await checks.readKillSwitch())) {
    return { admit: false, reason: 'offline', status: 503 };
  }

  return { admit: true, body };
}
