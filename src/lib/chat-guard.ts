// Pure admission logic for /api/chat; Redis and limiter I/O is injected so it stays testable.

// Under Gemini's 15 RPM / 500 RPD free-tier limits, leaving headroom for scheduled evals.
export const CHAT_GLOBAL_PER_MINUTE = 12;
export const CHAT_DAILY_BUDGET = 400;

const CHAT_REJECTION_REASONS = ['rate_limited', 'busy', 'offline'] as const;

export type ChatRejectionReason = (typeof CHAT_REJECTION_REASONS)[number];

export interface LimitOutcome {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export type ChatAdmission =
  | { admit: true }
  | {
      admit: false;
      reason: ChatRejectionReason;
      status: 429 | 503;
      retryAfterSeconds?: number;
      ipLimit?: LimitOutcome;
    };

// Any value except unset, empty, "0" or "false" turns the switch on.
export function isKillSwitchOn(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false';
}

function secondsUntil(resetMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((resetMs - nowMs) / 1000));
}

/**
 * Runs the guards in order and stops at the first rejection, so a rejected request never
 * spends a later guard's budget. A null result means the check failed open.
 */
export async function decideChatAdmission(checks: {
  readKillSwitch: () => Promise<unknown>;
  limitIp: () => Promise<LimitOutcome | null>;
  limitGlobal: () => Promise<LimitOutcome | null>;
  limitDaily: () => Promise<LimitOutcome | null>;
  now?: () => number;
}): Promise<ChatAdmission> {
  const nowMs = (checks.now ?? Date.now)();

  if (isKillSwitchOn(await checks.readKillSwitch())) {
    return { admit: false, reason: 'offline', status: 503 };
  }

  const ipLimit = await checks.limitIp();
  if (ipLimit && !ipLimit.success) {
    return {
      admit: false,
      reason: 'rate_limited',
      status: 429,
      retryAfterSeconds: secondsUntil(ipLimit.reset, nowMs),
      ipLimit,
    };
  }

  const globalLimit = await checks.limitGlobal();
  if (globalLimit && !globalLimit.success) {
    return {
      admit: false,
      reason: 'busy',
      status: 503,
      retryAfterSeconds: secondsUntil(globalLimit.reset, nowMs),
    };
  }

  const dailyLimit = await checks.limitDaily();
  if (dailyLimit && !dailyLimit.success) {
    return {
      admit: false,
      reason: 'busy',
      status: 503,
      retryAfterSeconds: secondsUntil(dailyLimit.reset, nowMs),
    };
  }

  return { admit: true };
}

function isRejectionReason(value: unknown): value is ChatRejectionReason {
  return (CHAT_REJECTION_REASONS as readonly unknown[]).includes(value);
}

// The AI SDK transport throws Error(responseText) on a non-OK response, so the JSON
// rejection body arrives as the error message.
export function rejectionReasonFromError(
  error: unknown,
): ChatRejectionReason | null {
  if (!(error instanceof Error)) return null;
  try {
    const body: unknown = JSON.parse(error.message);
    if (typeof body !== 'object' || body === null) return null;
    const { reason } = body as { reason?: unknown };
    return isRejectionReason(reason) ? reason : null;
  } catch {
    return null;
  }
}

const REJECTION_NOTICES: Record<ChatRejectionReason, string> = {
  rate_limited: 'Easy — too many messages too fast. Try again in a moment.',
  busy: "The agent's swamped right now. Try again in a minute — or type help to use the shell meanwhile.",
  offline:
    'The agent is offline for maintenance. The shell still works — type help.',
};

const GENERIC_NOTICE = "Couldn't reach the agent. Try again.";

export function chatErrorNotice(error: unknown): string {
  const reason = rejectionReasonFromError(error);
  return reason ? REJECTION_NOTICES[reason] : GENERIC_NOTICE;
}
