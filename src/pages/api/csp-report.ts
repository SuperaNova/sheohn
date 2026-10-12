import type { APIRoute } from 'astro';
import { createRateLimiter, safeLimit } from '../../lib/ratelimit';
import { normalizeCspReportBody } from '../../lib/csp-report-shape';
import { recordViolation } from '../../lib/csp-redis';

export const prerender = false;

const MAX_BODY_BYTES = 16_000;

// `report-uri` sends application/csp-report; `report-to` sends application/reports+json; vercel.json sets both.
const ALLOWED_CONTENT_TYPES = [
  'application/csp-report',
  'application/reports+json',
];

// Dedup collapses repeated violations into one Redis entry; this still bounds request volume.
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

  // Sequential: recordViolation reads-then-writes the entry cap, so concurrent calls could race.
  for (const violation of violations) {
    try {
      await recordViolation(violation);
    } catch (err) {
      // Browsers ignore the report response; log and keep 204ing.
      console.error('[csp-report] recordViolation failed:', err);
    }
  }

  return new Response(null, { status: 204 });
};
