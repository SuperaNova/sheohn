// Loads the production-only Pagefind bundle (written by `postbuild`, absent under `npm run dev`).
// Its WebAssembly module needs 'wasm-unsafe-eval' in vercel.json's script-src.

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

/** The subset of Pagefind's browser API this client uses (no published npm types). */
interface PagefindApi {
  init: () => Promise<void>;
  search: (query: string) => Promise<PagefindSearchResponse>;
}

/** A rendered search result: title, excerpt, URL. */
export interface PagefindResult {
  title: string;
  excerpt: string;
  url: string;
}

// undefined = not attempted; null = index unavailable; otherwise the initialized API.
let pagefindModule: PagefindApi | null | undefined;

// Routed through a variable so tsc types the runtime-only import as `Promise<any>`.
const PAGEFIND_ENTRY_PATH = '/pagefind/pagefind.js';

/** Imports and initializes Pagefind; returns `null` on any failure instead of throwing. */
export async function loadPagefind(): Promise<PagefindApi | null> {
  if (pagefindModule !== undefined) return pagefindModule;
  try {
    // `@vite-ignore` stops Vite from trying to resolve this build-time-unknown path.
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

/** Searches the Pagefind index; `null` means index unavailable, `[]` means no matches. */
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
