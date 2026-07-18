// Pure normalizer for the two shapes a browser can POST to /api/csp-report:
// the legacy `report-uri` single-object shape, and the Reporting API's
// `report-to` batch-array shape. No IO — colocated spec covers both shapes.
import { z } from 'zod';

export interface NormalizedViolation {
  directive: string;
  blockedUri: string;
}

const UNKNOWN = 'unknown';

// Bounds a hostile report's strings before they're dedup-keyed and stored —
// an attacker-controlled directive/blockedUri otherwise flows straight into
// Redis and the /status panel with no size limit of its own.
const MAX_DIRECTIVE_LENGTH = 200;
const MAX_BLOCKED_URI_LENGTH = 500;

function cap(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

// Legacy shape (`report-uri`): { "csp-report": { "violated-directive", ... } }
const LegacyReportSchema = z.object({
  'csp-report': z.looseObject({
    'violated-directive': z.string().optional(),
    'effective-directive': z.string().optional(),
    'blocked-uri': z.string().optional(),
  }),
});

// Reporting API shape (`report-to`): an array of reports, one per violation.
// Field names are camelCase per the spec (blockedURL); some older
// implementations sent blockedURI, so both are checked.
const ReportingApiEntrySchema = z.looseObject({
  type: z.string().optional(),
  body: z
    .looseObject({
      effectiveDirective: z.string().optional(),
      blockedURL: z.string().optional(),
      blockedURI: z.string().optional(),
    })
    .optional(),
});

const ReportingApiBatchSchema = z.array(ReportingApiEntrySchema).max(50);

/**
 * Normalizes either shape into a flat list of {directive, blockedUri} pairs.
 * Returns [] for a payload matching neither — callers should treat that as
 * "nothing to record", not an error (CSP reporting never expects a body back).
 */
export function normalizeCspReportBody(
  payload: unknown,
): NormalizedViolation[] {
  const legacy = LegacyReportSchema.safeParse(payload);
  if (legacy.success) {
    const report = legacy.data['csp-report'];
    return [
      {
        directive: cap(
          report['effective-directive'] ||
            report['violated-directive'] ||
            UNKNOWN,
          MAX_DIRECTIVE_LENGTH,
        ),
        blockedUri: cap(
          report['blocked-uri'] || UNKNOWN,
          MAX_BLOCKED_URI_LENGTH,
        ),
      },
    ];
  }

  const batch = ReportingApiBatchSchema.safeParse(payload);
  if (batch.success) {
    return batch.data
      .filter((entry) => !entry.type || entry.type === 'csp-violation')
      .map((entry) => ({
        directive: cap(
          entry.body?.effectiveDirective || UNKNOWN,
          MAX_DIRECTIVE_LENGTH,
        ),
        blockedUri: cap(
          entry.body?.blockedURL || entry.body?.blockedURI || UNKNOWN,
          MAX_BLOCKED_URI_LENGTH,
        ),
      }));
  }

  return [];
}
