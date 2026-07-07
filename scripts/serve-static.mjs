#!/usr/bin/env node
// Minimal, dependency-free static file server used ONLY by
// playwright.visual.config.ts's webServer.
//
// Why not `astro preview`: this project's build uses the @astrojs/vercel
// adapter, which puts the prerendered `output: 'static'` pages under
// dist/client/ (mirrored to .vercel/output/static/) alongside a
// dist/server/ SSR bundle for the opted-out API routes. `astro preview`
// isn't adapter-aware here — it looks for a flat dist/ directory and 404s
// every route (verified locally: it serves Astro's generic 404 page for
// every path, including `/`). Lighthouse CI already sidesteps this the same
// way (see lighthouserc.json / lighthouserc.mobile.json's
// `staticDistDir: "./.vercel/output/static"`) by using its own static file
// server against that exact directory instead of `astro preview` — this
// script does the same for Playwright.
//
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

// Tries the literal path, then directory-index and .html fallbacks — the
// same resolution order a static host (Vercel included) applies for a
// prerendered Astro site's clean URLs (e.g. `/about` -> `/about/index.html`).
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
  // Mirror the Vercel routes-manifest catch-all (.vercel/output/config.json's
  // final rule): anything unmatched renders the site's own 404 page.
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
