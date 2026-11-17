import { createHash } from 'node:crypto';

const SCRIPT_ELEMENT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const EXECUTABLE_TYPES = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
]);

function isExecutableInline(attributes: string): boolean {
  if (/(^|\s)src\s*=/i.test(attributes)) return false;
  const typeMatch =
    /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attributes);
  const type = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? '')
    .trim()
    .toLowerCase();
  return EXECUTABLE_TYPES.has(type);
}

export function extractInlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const match of html.matchAll(SCRIPT_ELEMENT)) {
    const [, attributes = '', body = ''] = match;
    if (!body.trim() || !isExecutableInline(attributes)) continue;
    // Browsers hash the parsed text, where the HTML parser has already turned CR/CRLF into LF.
    const text = body.replace(/\r\n?/g, '\n');
    const digest = createHash('sha256').update(text, 'utf8').digest('base64');
    hashes.add(`'sha256-${digest}'`);
  }
  return [...hashes].sort();
}

function splitDirectives(csp: string): string[] {
  return csp.split('; ');
}

function isScriptSrc(directive: string): boolean {
  return /^script-src(\s|$)/.test(directive);
}

const isHashToken = (token: string) => token.startsWith("'sha256-");

export function scriptSrcTokens(csp: string): string[] {
  const directive = splitDirectives(csp).find(isScriptSrc);
  if (!directive) throw new Error('CSP has no script-src directive');
  return directive.split(/\s+/).slice(1);
}

export function scriptSrcHashes(csp: string): string[] {
  return scriptSrcTokens(csp).filter(isHashToken).sort();
}

export function replaceScriptSrc(csp: string, hashes: string[]): string {
  const kept = scriptSrcTokens(csp).filter(
    (token) => !isHashToken(token) && token !== "'unsafe-inline'",
  );
  const rewritten = ['script-src', ...kept, ...[...hashes].sort()].join(' ');
  return splitDirectives(csp)
    .map((directive) => (isScriptSrc(directive) ? rewritten : directive))
    .join('; ');
}
