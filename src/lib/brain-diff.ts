// Pure logic for the brain-as-code CI pipeline; `scripts/update-brain.ts`
// wraps it. Lives under src/ so vitest's `src/**` include glob covers it.
//
// Content-hash IDs (`fact_<sha256-prefix>`) are stable across reorders and
// change with a fact's text, so a set-diff by ID drives add/remove sync
// (index-based IDs left stale vectors behind).
import { createHash } from 'node:crypto';

/** One entry of a brain manifest: a fact's content-hash ID. */
export type ManifestEntry = { id: string };

/** Result of diffing two manifests by ID. */
export type ManifestDiff = {
  toAdd: ManifestEntry[];
  toRemove: ManifestEntry[];
};

/**
 * Deterministic content-hash ID for a fact string: `'fact_' + sha256(text)`,
 * truncated to the first 12 hex chars. Stable across reorders (depends only
 * on the text), and changes whenever the fact's text changes by even one
 * character — which is the desired cache-invalidation behavior for the
 * Upstash sync (a changed fact should re-embed under a new ID rather than
 * silently overwrite the old vector's meaning).
 */
export function hashFact(text: string): string {
  return 'fact_' + createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/** Maps each fact string to its hashed-ID manifest entry, in input order. */
export function computeManifest(facts: string[]): ManifestEntry[] {
  return facts.map((fact) => ({ id: hashFact(fact) }));
}

/**
 * Pure set-diff by `id` between the previous (committed) manifest and the
 * next (freshly computed from the current facts file) manifest.
 *
 * - `toAdd`: entries present in `next` but absent from `previous` — new or
 *   changed facts that need to be embedded and upserted.
 * - `toRemove`: entries present in `previous` but absent from `next` —
 *   facts that were deleted or edited (an edit changes the hash, so the old
 *   ID becomes orphaned and must be deleted from Upstash) and whose old
 *   vector must be removed.
 */
export function diffManifests(
  previous: ManifestEntry[],
  next: ManifestEntry[],
): ManifestDiff {
  const previousIds = new Set(previous.map((e) => e.id));
  const nextIds = new Set(next.map((e) => e.id));

  const toAdd = next.filter((e) => !previousIds.has(e.id));
  const toRemove = previous.filter((e) => !nextIds.has(e.id));

  return { toAdd, toRemove };
}
