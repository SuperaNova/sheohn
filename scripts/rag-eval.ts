// Retrieval-only RAG eval: embeds each query and queries the index exactly as
// query_jared_memory does, with no LLM in the loop. Makes billed Gemini and
// Upstash calls; needs GOOGLE_GENERATIVE_AI_API_KEY and UPSTASH_VECTOR_REST_*.
// Usage: npx tsx scripts/rag-eval.ts
import 'dotenv/config';
import { embed } from 'ai';
import { google } from '@ai-sdk/google';
import {
  getVectorIndex,
  RAG_EMBEDDING_DIMENSIONS,
  RAG_EMBEDDING_MODEL,
  RAG_MIN_SCORE,
  RAG_TOP_K,
  type RagFact,
} from '../src/lib/rag';
import {
  scoreCase,
  summarizeResults,
  formatResultsTable,
  formatSummary,
  type RagEvalCaseResult,
} from '../src/lib/rag-eval';
import { labeledQueries, toRagEvalCase } from './rag-eval-cases';

async function retrieve(query: string): Promise<RagFact[]> {
  const { embedding } = await embed({
    model: google.embeddingModel(RAG_EMBEDDING_MODEL),
    value: query,
    providerOptions: {
      google: { outputDimensionality: RAG_EMBEDDING_DIMENSIONS },
    },
  });

  const results = await getVectorIndex().query({
    vector: embedding,
    topK: RAG_TOP_K,
    includeMetadata: true,
  });

  return results.map((r) => ({
    id: String(r.id),
    text: String(r.metadata?.text ?? 'Unknown fact'),
    score: r.score,
  }));
}

async function main(): Promise<void> {
  const results: RagEvalCaseResult[] = [];

  for (const labeled of labeledQueries) {
    const testCase = toRagEvalCase(labeled);
    const hits = await retrieve(testCase.query);
    results.push(scoreCase(testCase, hits, RAG_MIN_SCORE));
  }

  console.log(
    `[rag-eval] ${results.length} case(s), topK=${RAG_TOP_K}, minScore=${RAG_MIN_SCORE}\n`,
  );
  for (const line of formatResultsTable(results)) console.log(line);
  console.log('');
  for (const line of formatSummary(summarizeResults(results)))
    console.log(line);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
