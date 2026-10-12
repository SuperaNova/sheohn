// Pure scoring and formatting for the retrieval-only RAG eval
// (scripts/rag-eval.ts). "Kept" mirrors query_jared_memory's RAG_MIN_SCORE filter.
import type { RagFact } from './rag';

/** One labelled query: a question and the fact ID(s) that should come back. */
export type RagEvalCase = {
  name: string;
  query: string;
  expectedFactIds: string[];
};

/**
 * - `hit`: the expected fact cleared the score threshold.
 * - `below-threshold`: retrieved within topK but filtered out by the threshold.
 * - `miss`: absent from topK entirely.
 */
type RagEvalStatus = 'hit' | 'below-threshold' | 'miss';

export type RagEvalCaseResult = {
  name: string;
  query: string;
  expectedFactIds: string[];
  /** Raw topK hits, production order (score descending), for debugging. */
  hits: RagFact[];
  /** 1-based rank of the expected fact among raw hits; null if absent. */
  matchedRank: number | null;
  /** Raw score of the expected fact; null if absent from topK entirely. */
  matchedScore: number | null;
  /** 1-based rank among score-threshold survivors; null if filtered out or absent. */
  keptRank: number | null;
  status: RagEvalStatus;
  recallAt1: boolean;
  recallAt3: boolean;
  recallAt5: boolean;
};

/** Scores one case against raw topK hits, using the best-ranked acceptable fact. */
export function scoreCase(
  testCase: RagEvalCase,
  hits: RagFact[],
  minScore: number,
): RagEvalCaseResult {
  const keptIds = hits.filter((h) => h.score >= minScore).map((h) => h.id);

  const matchIndex = hits.findIndex((h) =>
    testCase.expectedFactIds.includes(h.id),
  );
  const matchedRank = matchIndex === -1 ? null : matchIndex + 1;
  const matchedScore = matchIndex === -1 ? null : hits[matchIndex]!.score;

  const keptIndex = keptIds.findIndex((id) =>
    testCase.expectedFactIds.includes(id),
  );
  const keptRank = keptIndex === -1 ? null : keptIndex + 1;

  const status: RagEvalStatus =
    keptRank !== null
      ? 'hit'
      : matchedRank !== null
        ? 'below-threshold'
        : 'miss';

  const recallAt = (k: number) => keptRank !== null && keptRank <= k;

  return {
    name: testCase.name,
    query: testCase.query,
    expectedFactIds: testCase.expectedFactIds,
    hits,
    matchedRank,
    matchedScore,
    keptRank,
    status,
    recallAt1: recallAt(1),
    recallAt3: recallAt(3),
    recallAt5: recallAt(5),
  };
}

export type RagEvalSummary = {
  totalCases: number;
  recallAt1: number; // percentage, 0-100, rounded to 1 decimal
  recallAt3: number;
  recallAt5: number;
  /** Mean expected-fact score over cases where it was retrieved; null if none. */
  meanMatchedScore: number | null;
  foundCount: number; // cases with matchedRank !== null (hit or below-threshold)
  missCount: number; // cases where the expected fact never appeared in topK
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Aggregates per-case results into the headline recall@k numbers. */
export function summarizeResults(results: RagEvalCaseResult[]): RagEvalSummary {
  const totalCases = results.length;
  const pct = (count: number) =>
    totalCases === 0 ? 0 : round1((count / totalCases) * 100);

  const matchedScores = results
    .map((r) => r.matchedScore)
    .filter((s): s is number => s !== null);

  return {
    totalCases,
    recallAt1: pct(results.filter((r) => r.recallAt1).length),
    recallAt3: pct(results.filter((r) => r.recallAt3).length),
    recallAt5: pct(results.filter((r) => r.recallAt5).length),
    meanMatchedScore:
      matchedScores.length === 0
        ? null
        : round3(
            matchedScores.reduce((sum, s) => sum + s, 0) / matchedScores.length,
          ),
    foundCount: results.filter((r) => r.matchedRank !== null).length,
    missCount: results.filter((r) => r.matchedRank === null).length,
  };
}

const STATUS_LABEL: Record<RagEvalStatus, string> = {
  hit: 'HIT',
  'below-threshold': 'BELOW-THRESHOLD',
  miss: 'MISS',
};

function padEnd(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/** Fixed-width table, one row per case. */
export function formatResultsTable(results: RagEvalCaseResult[]): string[] {
  const statusWidth = Math.max(
    ...Object.values(STATUS_LABEL).map((s) => s.length),
  );
  const lines: string[] = [];
  for (const r of results) {
    const status = padEnd(STATUS_LABEL[r.status], statusWidth);
    const rank =
      r.keptRank !== null
        ? `#${r.keptRank}`
        : r.matchedRank !== null
          ? `#${r.matchedRank} (raw)`
          : '-';
    const score = r.matchedScore !== null ? r.matchedScore.toFixed(3) : '-';
    lines.push(
      `[${status}] rank ${padEnd(rank, 10)} score ${padEnd(score, 6)} ${r.name}`,
    );
  }
  return lines;
}

/** Aggregate recall@k and mean-score lines. */
export function formatSummary(summary: RagEvalSummary): string[] {
  return [
    `cases: ${summary.totalCases} (${summary.foundCount} retrieved at all, ${summary.missCount} never appeared in topK)`,
    `recall@1: ${summary.recallAt1}%`,
    `recall@3: ${summary.recallAt3}%`,
    `recall@5: ${summary.recallAt5}%`,
    `mean score of matched fact: ${summary.meanMatchedScore === null ? 'n/a (no case ever retrieved its fact)' : summary.meanMatchedScore}`,
  ];
}
