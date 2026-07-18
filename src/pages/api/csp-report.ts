import type { APIRoute } from 'astro';
import { createRateLimiter, safeLimit } from '../../lib/ratelimit';
import { normalizeCspReportBody } from '../../lib/csp-report-shape';
import { recordViolation } from '../../lib/csp-redis';

export const prerender = false;

const MAX_BODY_BYTES = 16_000;

// Legacy `report-uri` reports arrive as application/csp-report; Reporting
// API `report-to` batches arrive as application/reports+json. vercel.json
// sends both directives, so either can show up here.
const ALLOWED_CONTENT_TYPES = [
  'application/csp-report',
  'application/reports+json',
];

// A broken deploy can make one browser fire the same handful of violations
// repeatedly on every resource load; dedup collapses that into one Redis
// entry with a rising count, but this still bounds the request volume itself.
const ratelimit = createRateLimiter('ratelimit_csp_report', 20, '10 s');

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!ALLOWED_CONTENT_TYPES.some((type) => contentType.includes(type))) {
    return new Response('Unsupported Media Type', { status: 415 });
  }

  const ip = clientAddress ?? '127.0.0.1';
  const limitResult = await safeLimit(ratelimit, `ratelimit_csp_report_${ip}`);
  if (limitResult && !limitResult.success) {
    return new Response('Too Many Requests', { status: 429 });
  }

  let payload: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return new Response('Payload Too Large', { status: 413 });
    }
    payload = JSON.parse(raw);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const violations = normalizeCspReportBody(payload);

  // Sequential, not Promise.all: recordViolation reads-then-writes the
  // distinct-entry cap, so concurrent calls within one batch could race it.
  for (const violation of violations) {
    try {
      await recordViolation(violation);
    } catch (err) {
      // Browsers never inspect the CSP report response — log and keep 204ing.
      console.error('[csp-report] recordViolation failed:', err);
    }
  }

  return new Response(null, { status: 204 });
};
