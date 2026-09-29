#!/usr/bin/env node
// Static file server for playwright.visual.config.ts's webServer. `astro preview` isn't
// adapter-aware with @astrojs/vercel and 404s every route, so this serves .vercel/output/static.
// Usage: node scripts/serve-static.mjs <dir> <port>

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const [, , rootArg, portArg] = process.argv;
const root = resolve(rootArg ?? '.vercel/output/static');
const port = Number(portArg ?? 4397);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Literal path, then directory-index and .html fallbacks, like a static host's clean URLs.
async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const candidates = clean.endsWith('/')
    ? [`${clean}index.html`]
    : [clean, `${clean}/index.html`, `${clean}.html`];
  for (const candidate of candidates) {
    const filePath = join(root, candidate);
    if (!filePath.startsWith(root)) continue; // guard against path traversal
    try {
      const stats = await stat(filePath);
      if (stats.isFile()) return filePath;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const found = await resolveFile(req.url ?? '/');
  if (found) {
    const body = await readFile(found);
    res.writeHead(200, {
      'content-type':
        CONTENT_TYPES[extname(found)] ?? 'application/octet-stream',
    });
    res.end(body);
    return;
  }
  // Unmatched routes render the site's own 404 page, like Vercel's catch-all.
  try {
    const notFound = await readFile(join(root, '404.html'));
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(notFound);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`[serve-static] serving ${root} on http://localhost:${port}`);
});
