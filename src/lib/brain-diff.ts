// Pure logic for the brain-as-code pipeline; `scripts/update-brain.ts` wraps it. Lives under src/
// so vitest's `src/**` glob covers it.
import { createHash } from 'node:crypto';

/** One entry of a brain manifest: a fact's content-hash ID. */
export type ManifestEntry = { id: string };

/** Result of diffing two manifests by ID. */
export type ManifestDiff = {
  toAdd: ManifestEntry[];
  toRemove: ManifestEntry[];
};

/** `'fact_' + sha256(text)` truncated to 12 hex chars; stable across reorders, changes with the text. */
export function hashFact(text: string): string {
  return 'fact_' + createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/** Maps each fact string to its hashed-ID manifest entry, in input order. */
export function computeManifest(facts: string[]): ManifestEntry[] {
  return facts.map((fact) => ({ id: hashFact(fact) }));
}

/**
 * Set-diff by `id` between the committed and freshly computed manifests.
 * `toAdd` is new or edited facts; `toRemove` is deleted or edited ones (an edit orphans the old ID).
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
