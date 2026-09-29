// `search`: full-text search over the deployed Pagefind index. Separate from `grep` because it is
// async and needs a third outcome ("index unavailable" vs. zero matches).

import type { Command, ShellOutput } from '../registry';
import { search as pagefindSearch } from '../pagefind-client';

/** Shown when the index is unavailable (dev, or a build without the postbuild step). */
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
