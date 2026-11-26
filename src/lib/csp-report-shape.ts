// Pure normalizer for the legacy `report-uri` object and Reporting API `report-to` array shapes.
import { z } from 'zod';

export interface NormalizedViolation {
  directive: string;
  blockedUri: string;
}

const UNKNOWN = 'unknown';

export const ALLOWED_REPORT_HOSTS: readonly string[] = [
  'sheohn.dev',
  'www.sheohn.dev',
];
const DEV_REPORT_HOSTS: readonly string[] = ['localhost', '127.0.0.1'];

const ALLOWED_DIRECTIVES: ReadonlySet<string> = new Set([
  'default-src',
  'script-src',
  'script-src-elem',
  'script-src-attr',
  'style-src',
  'style-src-elem',
  'style-src-attr',
  'img-src',
  'font-src',
  'connect-src',
  'media-src',
  'object-src',
  'frame-src',
  'frame-ancestors',
  'worker-src',
  'child-src',
  'manifest-src',
  'base-uri',
  'form-action',
  'upgrade-insecure-requests',
  'report-uri',
  'report-to',
]);

const BLOCKED_KEYWORDS: ReadonlySet<string> = new Set([
  'inline',
  'eval',
  'data',
  'blob',
  'self',
  'wasm-eval',
]);

function isAllowedDocumentUri(documentUri: string | undefined): boolean {
  if (!documentUri) return false;
  let hostname: string;
  try {
    hostname = new URL(documentUri).hostname;
  } catch {
    return false;
  }
  if (ALLOWED_REPORT_HOSTS.includes(hostname)) return true;
  return import.meta.env.DEV && DEV_REPORT_HOSTS.includes(hostname);
}

// Violated-directive values can carry a policy suffix ("script-src 'self'"); only the name is kept.
function toAllowedDirective(raw: string | undefined): string | null {
  const name = raw?.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return ALLOWED_DIRECTIVES.has(name) ? name : null;
}

// Stores at most scheme+host, or a CSP keyword; never free text.
function reduceBlockedUri(raw: string | undefined): string {
  if (!raw) return UNKNOWN;
  const keyword = raw.trim().toLowerCase().replace(/^'|'$/g, '');
  if (BLOCKED_KEYWORDS.has(keyword)) return keyword;
  try {
    const { origin } = new URL(raw);
    if (origin !== 'null') return origin;
  } catch {
    // fall through
  }
  return UNKNOWN;
}

// Legacy shape (`report-uri`): { "csp-report": { "violated-directive", ... } }
const LegacyReportSchema = z.object({
  'csp-report': z.looseObject({
    'document-uri': z.string().optional(),
    'violated-directive': z.string().optional(),
    'effective-directive': z.string().optional(),
    'blocked-uri': z.string().optional(),
  }),
});

// Reporting API shape (`report-to`): an array of reports; blockedURL, with older blockedURI also checked.
const ReportingApiEntrySchema = z.looseObject({
  type: z.string().optional(),
  url: z.string().optional(),
  body: z
    .looseObject({
      effectiveDirective: z.string().optional(),
      blockedURL: z.string().optional(),
      blockedURI: z.string().optional(),
    })
    .optional(),
});

const ReportingApiBatchSchema = z.array(ReportingApiEntrySchema).max(50);

/** Normalizes either shape to {directive, blockedUri} pairs; [] for anything else or another site's report. */
export function normalizeCspReportBody(
  payload: unknown,
): NormalizedViolation[] {
  const legacy = LegacyReportSchema.safeParse(payload);
  if (legacy.success) {
    const report = legacy.data['csp-report'];
    const directive = toAllowedDirective(
      report['effective-directive'] || report['violated-directive'],
    );
    if (!isAllowedDocumentUri(report['document-uri']) || !directive) return [];
    return [{ directive, blockedUri: reduceBlockedUri(report['blocked-uri']) }];
  }

  const batch = ReportingApiBatchSchema.safeParse(payload);
  if (batch.success) {
    const violations: NormalizedViolation[] = [];
    for (const entry of batch.data) {
      if (entry.type && entry.type !== 'csp-violation') continue;
      const directive = toAllowedDirective(entry.body?.effectiveDirective);
      if (!isAllowedDocumentUri(entry.url) || !directive) continue;
      violations.push({
        directive,
        blockedUri: reduceBlockedUri(
          entry.body?.blockedURL || entry.body?.blockedURI,
        ),
      });
    }
    return violations;
  }

  return [];
}
