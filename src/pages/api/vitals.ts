import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getCollection } from 'astro:content';
import { createRateLimiter, safeLimit } from '../../lib/ratelimit';
import {
  buildKnownRoutes,
  isKnownRoute,
  normalizeRoute,
} from '../../lib/rum-routes';
import {
  recordPageview,
  recordVital,
  utcDateString,
} from '../../lib/rum-redis';

export const prerender = false;

const MAX_BODY_BYTES = 2_000;

// Anonymous by construction: the schema has no ip/userAgent/cookie field.
const VitalsSchema = z.object({
  route: z.string().min(1).max(200),
  metric: z.enum(['lcp', 'cls', 'inp', 'pageview']),
  value: z.number().nonnegative().optional(),
});

// Per-visitor limiting would need an IP, conflicting with anonymity; so one global per-minute cap.
const ratelimit = createRateLimiter('ratelimit_vitals', 120, '1 m');

export const POST: APIRoute = async ({ request }) => {
  if (
    !(request.headers.get('content-type') ?? '').includes('application/json')
  ) {
    return new Response('Unsupported Media Type', { status: 415 });
  }

  const limitResult = await safeLimit(ratelimit, 'global');
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

  const parsed = VitalsSchema.safeParse(payload);
  if (!parsed.success) {
    return new Response('Bad Request', { status: 400 });
  }

  const { route: rawRoute, metric, value } = parsed.data;
  if (metric !== 'pageview' && value === undefined) {
    return new Response('Bad Request', { status: 400 });
  }

  // Route allowlist before any Redis write; arbitrary routes would mint unbounded keys.
  let knownRoutes: string[];
  try {
    const projects = await getCollection('projects');
    knownRoutes = buildKnownRoutes(projects.map((p) => ({ id: p.id })));
  } catch (err) {
    console.error('[vitals] failed to resolve known routes:', err);
    return new Response('Bad Request', { status: 400 });
  }

  const route = normalizeRoute(rawRoute);
  if (!isKnownRoute(route, knownRoutes)) {
    return new Response('Unknown route', { status: 400 });
  }

  const date = utcDateString();

  try {
    if (metric === 'pageview') {
      await recordPageview({ route, date });
    } else {
      await recordVital({ route, metric, value: value as number, date });
    }
  } catch (err) {
    // sendBeacon ignores the response; log and return 204 so the browser doesn't retry.
    console.error('[vitals] record failed:', err);
  }

  return new Response(null, { status: 204 });
};
