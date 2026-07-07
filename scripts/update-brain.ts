// Brain-as-code sync (sonnet-specs/04): pushes scripts/my_facts.json into
// the Upstash Vector index, keyed by content-hash IDs so the sync only
// embeds new/changed facts and deletes vectors for removed ones (fixes
// audit bug B4 — the old index-based `fact_${i}` IDs never deleted stale
// vectors when facts were edited/reordered/removed).
//
// Diff logic (hashing + manifest set-diff) lives in src/lib/brain-diff.ts so
// it's unit-tested and reusable; this script is the thin I/O wrapper: reads
// scripts/my_facts.json + scripts/brain-manifest.json, calls Upstash/Gemini,
// and rewrites the manifest.
//
// Usage:
//   npx tsx scripts/update-brain.ts             # real sync (needs credentials)
//   npx tsx scripts/update-brain.ts --dry-run   # diff only, no network calls,
//                                                 # no manifest rewrite — safe
//                                                 # to run without credentials
//                                                 # (used by brain.yml's PR job)
import { Index } from '@upstash/vector';
import { embedMany } from 'ai';
import { google } from '@ai-sdk/google';
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeManifest,
  diffManifests,
  type ManifestEntry,
} from '../src/lib/brain-diff';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const factsPath = path.join(__dirname, 'my_facts.json');
const manifestPath = path.join(__dirname, 'brain-manifest.json');

const isDryRun = process.argv.includes('--dry-run');

function readFacts(): string[] {
  return JSON.parse(fs.readFileSync(factsPath, 'utf8'));
}

/** Tolerates a missing or empty manifest file — treated as `[]`. */
function readManifest(): ManifestEntry[] {
  if (!fs.existsSync(manifestPath)) return [];
  const raw = fs.readFileSync(manifestPath, 'utf8').trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeManifest(manifest: ManifestEntry[]): void {
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
}

async function updateBrain(): Promise<void> {
  const myFacts = readFacts();
  const previousManifest = readManifest();
  const nextManifest = computeManifest(myFacts);
  const { toAdd, toRemove } = diffManifests(previousManifest, nextManifest);

  // Map hashed ID -> fact text so only the new/changed facts get embedded
  // (and so the dry-run diff below can show the added facts' text).
  const idToText = new Map(
    myFacts.map((fact, i) => [nextManifest[i]!.id, fact]),
  );

  if (isDryRun) {
    // No embedMany/Upstash calls, no manifest rewrite — safe to run without
    // real Gemini/Upstash credentials (this is what brain.yml's PR job runs).
    // The summary line goes to stderr so stdout stays pure JSON — brain.yml
    // pipes stdout straight into a PR comment via `tee`.
    console.error(
      `[update-brain] dry-run: ${toAdd.length} to add, ${toRemove.length} to remove.`,
    );
    console.log(
      JSON.stringify(
        {
          toAdd: toAdd.map((e) => ({ id: e.id, text: idToText.get(e.id) })),
          toRemove: toRemove.map((e) => e.id),
        },
        null,
        2,
      ),
    );
    return;
  }

  const index = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL as string,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN as string,
  });

  if (toAdd.length > 0) {
    console.log(
      `[update-brain] embedding ${toAdd.length} new/changed fact(s)...`,
    );
    const textsToAdd = toAdd.map((e) => idToText.get(e.id)!);
    const { embeddings } = await embedMany({
      model: google.embeddingModel('gemini-embedding-001'),
      values: textsToAdd,
      providerOptions: {
        google: {
          outputDimensionality: 1536,
        },
      },
    });

    const vectors = toAdd.map((entry, i) => ({
      id: entry.id,
      vector: embeddings[i]!,
      metadata: { text: textsToAdd[i]! }, // exact fact string, read by query_jared_memory
    }));

    console.log(`[update-brain] upserting ${vectors.length} vector(s)...`);
    await index.upsert(vectors);
  } else {
    console.log('[update-brain] no new/changed facts to embed.');
  }

  if (toRemove.length > 0) {
    const idsToRemove = toRemove.map((e) => e.id);
    console.log(
      `[update-brain] deleting ${idsToRemove.length} stale vector(s): ${idsToRemove.join(', ')}`,
    );
    await index.delete(idsToRemove);
  } else {
    console.log('[update-brain] no stale vectors to delete.');
  }

  writeManifest(nextManifest);
  console.log(`[update-brain] wrote ${manifestPath}`);
  console.log('[update-brain] successfully updated');
}

updateBrain().catch((err) => {
  console.error(err);
  process.exit(1);
});
