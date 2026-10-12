// Syncs scripts/my_facts.json into the Upstash Vector index by content-hash ID; diff logic is in
// src/lib/brain-diff.ts.
// Usage: npx tsx scripts/update-brain.ts [--dry-run]  (dry run: diff only, no network, no manifest write)
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

  // Hashed ID -> fact text, so only new/changed facts get embedded.
  const idToText = new Map(
    myFacts.map((fact, i) => [nextManifest[i]!.id, fact]),
  );

  if (isDryRun) {
    // Dry run needs no credentials. The summary goes to stderr so stdout stays pure JSON for brain.yml's PR comment.
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
