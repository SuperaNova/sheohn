// `search`: full-text search over the real, deployed Pagefind index (see
// the `postbuild` script in package.json). A SIBLING to `grep`, not an
// extension of it (spec #17's locked choice): `grep` (spec #01, `./text.ts`)
// does synchronous substring matching over the in-memory virtual FS, and
// always succeeds/fails on the same simple pass/fail contract. `search` is
// a separate, async query against a real, WebAssembly-backed site index
// that plainly does not exist in dev — it needs a third outcome grep's
// contract has no room for ("index unavailable" vs. "zero matches"), so
// giving it its own builtin keeps grep's existing behavior/tests untouched
// and keeps each command's error semantics simple to reason about, the way
// a real shell composes distinct tools (`grep` vs. a hypothetical `ag`)
// rather than overloading one flag-riddled command.

import type { Command, ShellOutput } from '../registry';
import { search as pagefindSearch } from '../pagefind-client';

/** Exact message spec #17 locks in for the "index unavailable" case (dev
 * mode, or a build that shipped without the postbuild indexing step) —
 * exported so the colocated test can assert on it without duplicating the
 * string. */
export const INDEX_UNAVAILABLE_MESSAGE =
  'search index available in production builds';

export const search: Command = {
  name: 'search',
  description:
    'Full-text search the live site via Pagefind (production builds only).',
  usage: 'search <query...>',
  run: async (args): Promise<ShellOutput> => {
    const query = args.join(' ').trim();
    if (!query) return { lines: ['search: missing query'], error: true };

    const results = await pagefindSearch(query);
    if (results === null) return { lines: [INDEX_UNAVAILABLE_MESSAGE] };
    if (results.length === 0) {
      return { lines: [`search: no results for "${query}"`] };
    }

    return {
      lines: results.map((r) => `${r.title} — ${r.excerpt} (${r.url})`),
    };
  },
};
