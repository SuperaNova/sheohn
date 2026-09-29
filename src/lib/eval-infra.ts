// Marks eval failures caused by upstream infrastructure (model overload,
// request timeouts) rather than agent behavior, so history can tell them apart.

const INFRA_ERROR_MARKER = '[infra]';

const INFRA_MESSAGE_PATTERNS = [
  /Request context disposed/i,
  /apiRequestContext\.\w+: Timeout/i,
  /Test timeout of \d+ms exceeded/i,
];

export class InfraError extends Error {
  constructor(message: string) {
    super(`${INFRA_ERROR_MARKER} ${message}`);
    this.name = 'InfraError';
  }
}

/** Upstream statuses that say nothing about the agent; a bare 500 is likely our own route's bug, so it stays a failure. */
export function isInfraStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export function isInfraErrorMessage(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes(INFRA_ERROR_MARKER) ||
    INFRA_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
  );
}

const BODY_SNIPPET_LENGTH = 200;

export function describeResponse(status: number, body: string): string {
  const snippet = body
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, BODY_SNIPPET_LENGTH);
  return `HTTP ${status}${snippet ? `: ${snippet}` : ' with an empty body'}`;
}
