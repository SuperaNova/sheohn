// Shared retrieval for the chat tool and the MCP search tool: embed, vector query, score filter, per-instance cache.
import { embed } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  RAG_EMBEDDING_DIMENSIONS,
  RAG_EMBEDDING_MODEL,
  RAG_MIN_SCORE,
  RAG_TOP_K,
  getVectorIndex,
  type RagFact,
  type RagQueryResult,
} from './rag';

interface VectorHit {
  id: string | number;
  score: number;
  metadata?: Record<string, unknown> | undefined;
}

export interface RagSearchDeps {
  embedQuery: (query: string) => Promise<number[]>;
  queryVectors: (vector: number[]) => Promise<VectorHit[]>;
}

const google = createGoogleGenerativeAI({
  apiKey:
    import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const defaultDeps: RagSearchDeps = {
  embedQuery: async (query) => {
    const { embedding } = await embed({
      model: google.embeddingModel(RAG_EMBEDDING_MODEL),
      value: query,
      providerOptions: {
        google: { outputDimensionality: RAG_EMBEDDING_DIMENSIONS },
      },
    });
    return embedding;
  },
  queryVectors: (vector) =>
    getVectorIndex().query({
      vector,
      topK: RAG_TOP_K,
      includeMetadata: true,
    }),
};

// Retries a transient failure (network blip, brief provider hiccup) with a
// short backoff before giving up, so retrieval doesn't hard-fail on the
// first blip.
async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 2,
  delayMs = 300,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  throw lastError;
}

// Caches results per warm serverless instance, so repeated common questions
// skip the embed + vector query round-trip. Capped and TTL'd so a long-lived
// instance can't accumulate unbounded entries from varied caller input.
const RAG_CACHE_TTL_MS = 10 * 60 * 1000;
const RAG_CACHE_MAX_ENTRIES = 200;
const ragCache = new Map<
  string,
  { result: RagQueryResult; expiresAt: number }
>();

function getCachedFacts(query: string): RagQueryResult | undefined {
  const key = query.trim().toLowerCase();
  const cached = ragCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt < Date.now()) {
    ragCache.delete(key);
    return undefined;
  }
  return cached.result;
}

function setCachedFacts(query: string, result: RagQueryResult): void {
  const key = query.trim().toLowerCase();
  if (ragCache.size >= RAG_CACHE_MAX_ENTRIES) {
    const oldestKey = ragCache.keys().next().value;
    if (oldestKey !== undefined) ragCache.delete(oldestKey);
  }
  ragCache.set(key, { result, expiresAt: Date.now() + RAG_CACHE_TTL_MS });
}

export function isFactsCached(query: string): boolean {
  return getCachedFacts(query) !== undefined;
}

export function clearFactsCache(): void {
  ragCache.clear();
}

/** Never rejects: a pipeline failure returns an empty result and is not cached. */
export async function searchFacts(
  query: string,
  options: {
    onCacheEvent?: (kind: 'hit' | 'miss') => void;
    deps?: RagSearchDeps;
  } = {},
): Promise<RagQueryResult> {
  const { embedQuery, queryVectors } = options.deps ?? defaultDeps;

  const cached = getCachedFacts(query);
  options.onCacheEvent?.(cached ? 'hit' : 'miss');
  if (cached) return cached;

  try {
    const embedding = await withRetry(() => embedQuery(query));
    const results = await withRetry(() => queryVectors(embedding));

    const hits: RagFact[] = results.map((r) => ({
      id: String(r.id),
      text: String(r.metadata?.text ?? 'Unknown fact'),
      score: r.score,
    }));

    const facts = hits.filter((h) => h.score >= RAG_MIN_SCORE);
    const filteredOut = hits.filter((h) => h.score < RAG_MIN_SCORE);

    const result: RagQueryResult = { query, facts, filteredOut };
    setCachedFacts(query, result);
    return result;
  } catch (err) {
    console.error('[RAG Pipeline] query_jared_memory failed:', err);
    return { query, facts: [], filteredOut: [] };
  }
}
