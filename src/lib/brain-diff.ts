// Pure, unit-testable logic for the brain-as-code CI pipeline
// (sonnet-specs/04). `scripts/update-brain.ts` is a thin wrapper around the
// functions in this file — Upstash/Gemini calls and file I/O live in the
// script, everything else (hashing, manifest diffing) lives here so it's
// covered by the `src/**` vitest include glob (see
// sonnet-specs/04-brain-as-code-ci.md's "Repo context" note on why this
// can't live under scripts/ and still be picked up by `npm run test:unit`).
//
// This fixes audit bug B4: the old `scripts/update-brain.ts` used
// index-based IDs (`fact_${i}`) and never deleted stale vectors when facts
// were removed or reordered. Content-hash IDs (`fact_<sha256-prefix>`) make
// the ID deterministic and stable across reorders, and change automatically
// when a fact's text changes — which is exactly the desired invalidation
// behavior, and lets a simple set-diff by ID drive add/remove sync.
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
