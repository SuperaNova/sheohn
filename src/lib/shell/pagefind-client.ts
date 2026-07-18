// Lazily loads the Pagefind browser search runtime from the static asset
// path `/pagefind/pagefind.js`. That file is written by the `postbuild` npm
// script (see `package.json`: `pagefind --site .vercel/output/static`),
// which runs after `astro build` completes — it does NOT exist under
// `npm run dev` (dev mode never runs a build), which is exactly why
// `loadPagefind()`/`search()` fail gracefully (return `null`) instead of
// throwing when the asset is missing, so callers can render a
// "not available in dev" message instead of an unhandled error.
//
// Pagefind compiles a WebAssembly module to run the search index — that
// requires 'wasm-unsafe-eval' in vercel.json's script-src CSP directive.

/** One raw hit from `PagefindApi.search()`, before its full data is fetched. */
interface PagefindSearchResultRef {
  id: string;
  score: number;
  data: () => Promise<PagefindResultData>;
}

/** The fields of a hit's resolved `data()` that this client renders. */
interface PagefindResultData {
  url: string;
  excerpt: string;
  meta: { title?: string; [key: string]: unknown };
}

interface PagefindSearchResponse {
  results: PagefindSearchResultRef[];
}

/** The subset of Pagefind's browser API (`/pagefind/pagefind.js`) this
 * client relies on. See https://pagefind.app/docs/api/ for the full
 * surface — there are no published npm types for this runtime bundle since
 * it's generated per-build, not an importable package. */
interface PagefindApi {
  init: () => Promise<void>;
  search: (query: string) => Promise<PagefindSearchResponse>;
}

/** A single rendered search result — title/excerpt/URL, the shape the
 * shell's `search` builtin renders one line per result from. */
export interface PagefindResult {
  title: string;
  excerpt: string;
  url: string;
}

// `undefined` = not attempted yet this session; `null` = attempted and the
// index is unavailable (dev mode, or a build that shipped without one);
// otherwise the loaded, initialized API. Cached so the dynamic import (and
// its network fetch of the index metadata) only ever happens once.
let pagefindModule: PagefindApi | null | undefined;

/**
 * Dynamically imports the production-only Pagefind browser bundle and
 * initializes it. Never throws — returns `null` on any failure (404 in dev,
 * a malformed/missing index, etc.) so callers can distinguish "index
 * unavailable" from a real error.
 */
// A runtime-only static asset path, not a source module in this repo —
// Pagefind writes it into the build output *after* Vite has already
// finished bundling, so there is nothing for either Vite or `tsc` to
// resolve at build time. Routed through a variable (rather than a string
// literal directly in the `import()` call) so `astro check`/`tsc` treat the
// dynamic import as `Promise<any>` instead of attempting — and failing —
// module resolution against it.
const PAGEFIND_ENTRY_PATH = '/pagefind/pagefind.js';

export async function loadPagefind(): Promise<PagefindApi | null> {
  if (pagefindModule !== undefined) return pagefindModule;
  try {
    // The `@vite-ignore` comment is required: without it, Vite tries to
    // statically analyze/rewrite this import at build time, which otherwise
    // produces a build warning (or a broken import) for a path it can never
    // actually resolve ahead of time.
    const mod = (await import(
      /* @vite-ignore */ PAGEFIND_ENTRY_PATH
    )) as PagefindApi;
    await mod.init();
    pagefindModule = mod;
  } catch {
    pagefindModule = null;
  }
  return pagefindModule;
}

/**
 * Searches the real, production Pagefind index for `query`. Returns `null`
 * specifically to signal "index unavailable" — distinct from an empty
 * array, which means the index loaded fine but nothing matched. The shell's
 * `search` builtin uses this distinction to print the graceful
 * "search index available in production builds" message only in the `null`
 * case, and a plain "no results" message for an empty array.
 */
export async function search(query: string): Promise<PagefindResult[] | null> {
  const pagefind = await loadPagefind();
  if (!pagefind) return null;

  const response = await pagefind.search(query);
  return Promise.all(
    response.results.map(async (hit) => {
      const data = await hit.data();
      return {
        title: data.meta.title ?? data.url,
        excerpt: data.excerpt.replace(/<[^>]+>/g, ''),
        url: data.url,
      };
    }),
  );
}
