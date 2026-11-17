// Keeps the script-src SHA-256 hashes in vercel.json in sync with the built HTML's inline scripts.
// Usage: npx tsx scripts/csp-hashes.ts [--write]
import fs from 'node:fs';
import path from 'node:path';
import {
  extractInlineScriptHashes,
  replaceScriptSrc,
  scriptSrcHashes,
  scriptSrcTokens,
} from '../src/lib/csp-hashes';

const STATIC_DIR = path.join('.vercel', 'output', 'static');
const VERCEL_CONFIG_PATH = 'vercel.json';
const CSP_HEADER = 'Content-Security-Policy';

interface VercelConfig {
  headers: { headers: { key: string; value: string }[] }[];
}

function listHtmlFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(fullPath);
    return entry.name.endsWith('.html') ? [fullPath] : [];
  });
}

function collectBuiltHashes(): string[] {
  const hashes = new Set<string>();
  for (const file of listHtmlFiles(STATIC_DIR)) {
    for (const hash of extractInlineScriptHashes(
      fs.readFileSync(file, 'utf-8'),
    )) {
      hashes.add(hash);
    }
  }
  return [...hashes].sort();
}

function findCspHeader(config: VercelConfig): { key: string; value: string } {
  for (const group of config.headers) {
    const header = group.headers.find((h) => h.key === CSP_HEADER);
    if (header) return header;
  }
  throw new Error(`${VERCEL_CONFIG_PATH} has no ${CSP_HEADER} header`);
}

function main(): void {
  if (!fs.existsSync(STATIC_DIR)) {
    console.error(`[csp] ${STATIC_DIR} not found; run npm run build first`);
    process.exit(1);
  }
  const builtHashes = collectBuiltHashes();
  const config = JSON.parse(
    fs.readFileSync(VERCEL_CONFIG_PATH, 'utf-8'),
  ) as VercelConfig;
  const header = findCspHeader(config);

  if (process.argv.includes('--write')) {
    header.value = replaceScriptSrc(header.value, builtHashes);
    fs.writeFileSync(
      VERCEL_CONFIG_PATH,
      JSON.stringify(config, null, 2) + '\n',
    );
    console.log(`csp: wrote ${builtHashes.length} script-src hashes`);
    return;
  }

  const currentHashes = scriptSrcHashes(header.value);
  const missing = builtHashes.filter((h) => !currentHashes.includes(h));
  const stale = currentHashes.filter((h) => !builtHashes.includes(h));
  const hasUnsafeInline = scriptSrcTokens(header.value).includes(
    "'unsafe-inline'",
  );
  if (!missing.length && !stale.length && !hasUnsafeInline) {
    console.log(`csp: script-src hashes match (${builtHashes.length})`);
    return;
  }
  for (const hash of missing)
    console.error(`csp: missing in vercel.json ${hash}`);
  for (const hash of stale) console.error(`csp: stale in vercel.json ${hash}`);
  if (hasUnsafeInline)
    console.error("csp: script-src contains 'unsafe-inline'");
  console.error('run: npm run csp:write');
  process.exit(1);
}

main();
