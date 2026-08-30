/**
 * Shared RAG (retrieval-augmented generation) types + tuning constants for
 * the `query_jared_memory` tool (src/pages/api/chat.ts) and everything that
 * consumes its output: the eval harness (tests/eval/parseAgentResponse.ts),
 * the footnote-citation UI (DeckChatMessage.svelte / DeckRichText.svelte),
 * and the `/trace` command (CommandDeck.svelte + shell/builtins/trace.ts).
 *
 * Living here (rather than only inline in chat.ts) lets both the SSR tool
 * and the client bundle import the exact same shape/formatting without
 * duplicating it.
 */

import { Index } from '@upstash/vector';

// Read defensively so this also works outside Vite (see uptime-redis.ts).
const metaEnv = (
  import.meta as ImportMeta & { env?: Record<string, string | undefined> }
).env;

let cachedIndex: Index | undefined;

/**
 * Lazily builds and memoizes the Upstash Vector client. Deferred to first use
 * (rather than module scope) so a missing env var throws a named error only
 * when `query_jared_memory` actually runs, instead of failing the whole
 * chat.ts route module at import time. Memoized so it still only builds once
 * per warm serverless instance.
 */
export function getVectorIndex(): Index {
  if (cachedIndex) return cachedIndex;

  const url =
    metaEnv?.UPSTASH_VECTOR_REST_URL || process.env.UPSTASH_VECTOR_REST_URL;
  const token =
    metaEnv?.UPSTASH_VECTOR_REST_TOKEN || process.env.UPSTASH_VECTOR_REST_TOKEN;

  const missing = [
    !url && 'UPSTASH_VECTOR_REST_URL',
    !token && 'UPSTASH_VECTOR_REST_TOKEN',
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Missing required env var(s): ${missing.join(', ')}`);
  }

  cachedIndex = new Index({ url, token });
  return cachedIndex;
}

/** A single retrieved chunk from the Upstash Vector index. */
export interface RagFact {
  id: string;
  text: string;
  score: number;
}

/**
 * Full retrieval trace for one `query_jared_memory` call: the query that was
 * embedded, the facts that cleared the relevance bar (ground the model's
 * answer + become footnote citations), and the candidates that scored below
 * it (surfaced only via `/trace`, for retrieval-pipeline transparency).
 */
export interface RagQueryResult {
  query: string;
  facts: RagFact[];
  filteredOut: RagFact[];
}

/**
 * Minimum Upstash cosine-similarity score for a retrieved chunk to be
 * trusted as grounding for an answer. Tunable — 0.75 is a starting value
 * picked to sit above "loosely related" noise while staying permissive
 * enough for paraphrased personal-fact chunks. Raise it if footnotes start
 * citing off-topic chunks; lower it if genuinely relevant facts get dropped
 * (see the "leadership facts" case in tests/eval/cases.ts, which documents a
 * chunk that should score above this bar but wasn't confirmed with live
 * credentials at the time this constant was chosen).
 */
export const RAG_MIN_SCORE = 0.75;

/**
 * Human-readable replay of a stored `RagQueryResult`, shared by both
 * `/trace` entry points (the shell builtin and the CommandDeck slash-command
 * fallback) so the two surfaces render identical output.
 */
export function formatRagTrace(trace: RagQueryResult | null): string[] {
  if (!trace) {
    return [
      'trace: no retrieval yet this session — ask the agent a background/skills question first.',
    ];
  }

  const totalCandidates = trace.facts.length + trace.filteredOut.length;
  const lines: string[] = [
    `query      "${trace.query}"`,
    `embedding  gemini-embedding-001 (1536d) — computed`,
    `retrieval  topK candidates: ${totalCandidates}`,
    '',
    `kept (score >= ${RAG_MIN_SCORE}):`,
  ];

  if (trace.facts.length === 0) {
    lines.push('  (none — nothing cleared the relevance threshold)');
  } else {
    for (const f of trace.facts) {
      lines.push(`  [${f.score.toFixed(3)}] ${f.text}`);
    }
  }

  lines.push('', 'filtered out (below threshold):');
  if (trace.filteredOut.length === 0) {
    lines.push('  (none)');
  } else {
    for (const f of trace.filteredOut) {
      lines.push(`  [${f.score.toFixed(3)}] ${f.text}`);
    }
  }

  return lines;
}
