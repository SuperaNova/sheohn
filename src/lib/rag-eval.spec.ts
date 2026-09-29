import { describe, expect, test } from 'vitest';
import {
  formatResultsTable,
  formatSummary,
  scoreCase,
  summarizeResults,
  type RagEvalCase,
  type RagEvalCaseResult,
} from './rag-eval';
import type { RagFact } from './rag';

const MIN_SCORE = 0.75;

function fact(id: string, score: number): RagFact {
  return { id, text: `text for ${id}`, score };
}

describe('scoreCase', () => {
  test('reports a hit when the expected fact clears the threshold', () => {
    const testCase: RagEvalCase = {
      name: 'education',
      query: 'where does he study',
      expectedFactIds: ['fact_a'],
    };
    const hits = [
      fact('fact_x', 0.9),
      fact('fact_a', 0.81),
      fact('fact_y', 0.7),
    ];

    const result = scoreCase(testCase, hits, MIN_SCORE);

    expect(result.status).toBe('hit');
    expect(result.matchedRank).toBe(2);
    expect(result.matchedScore).toBe(0.81);
    expect(result.keptRank).toBe(2);
    expect(result.recallAt1).toBe(false);
    expect(result.recallAt3).toBe(true);
    expect(result.recallAt5).toBe(true);
  });

  test('reports below-threshold when the fact is retrieved but scores under minScore', () => {
    // This is the shape of the "leadership facts" bug documented in
    // tests/eval/cases.ts: the fact is in the index and gets retrieved, but
    // never clears the relevance bar.
    const testCase: RagEvalCase = {
      name: 'leadership',
      query: 'what leadership roles',
      expectedFactIds: ['fact_president'],
    };
    const hits = [
      fact('fact_other1', 0.8),
      fact('fact_other2', 0.78),
      fact('fact_president', 0.6),
    ];

    const result = scoreCase(testCase, hits, MIN_SCORE);

    expect(result.status).toBe('below-threshold');
    expect(result.matchedRank).toBe(3);
    expect(result.matchedScore).toBe(0.6);
    expect(result.keptRank).toBeNull();
    expect(result.recallAt1).toBe(false);
    expect(result.recallAt3).toBe(false);
    expect(result.recallAt5).toBe(false);
  });

  test('reports a miss when the expected fact never appears in the hits', () => {
    const testCase: RagEvalCase = {
      name: 'obscure',
      query: 'something never indexed',
      expectedFactIds: ['fact_missing'],
    };
    const hits = [fact('fact_a', 0.9), fact('fact_b', 0.85)];

    const result = scoreCase(testCase, hits, MIN_SCORE);

    expect(result.status).toBe('miss');
    expect(result.matchedRank).toBeNull();
    expect(result.matchedScore).toBeNull();
    expect(result.keptRank).toBeNull();
    expect(result.recallAt1).toBe(false);
    expect(result.recallAt3).toBe(false);
    expect(result.recallAt5).toBe(false);
  });

  test('recallAt1 is true only when the kept rank is exactly 1', () => {
    const testCase: RagEvalCase = {
      name: 'top hit',
      query: 'q',
      expectedFactIds: ['fact_a'],
    };
    const hits = [fact('fact_a', 0.95), fact('fact_b', 0.8)];

    const result = scoreCase(testCase, hits, MIN_SCORE);

    expect(result.recallAt1).toBe(true);
    expect(result.recallAt3).toBe(true);
    expect(result.recallAt5).toBe(true);
  });

  test('credits the best-ranked fact when multiple expected facts are acceptable', () => {
    const testCase: RagEvalCase = {
      name: 'scholarship',
      query: 'scholarships',
      expectedFactIds: ['fact_jlss', 'fact_dance'],
    };
    const hits = [
      fact('fact_other', 0.9),
      fact('fact_dance', 0.82),
      fact('fact_jlss', 0.6),
    ];

    const result = scoreCase(testCase, hits, MIN_SCORE);

    // fact_dance clears the threshold (kept-rank 2, behind fact_other) even
    // though fact_jlss (listed first) only appears below the threshold.
    expect(result.status).toBe('hit');
    expect(result.keptRank).toBe(2);
    expect(result.matchedRank).toBe(2); // raw rank of the first-encountered match, fact_dance
  });

  test('a threshold filtering out an earlier hit shifts kept rank down', () => {
    const testCase: RagEvalCase = {
      name: 'shifted rank',
      query: 'q',
      expectedFactIds: ['fact_c'],
    };
    // fact_b is below threshold and gets removed from the kept sequence, so
    // fact_c becomes kept-rank 2 despite being raw-rank 3.
    const hits = [
      fact('fact_a', 0.9),
      fact('fact_b', 0.5),
      fact('fact_c', 0.8),
    ];

    const result = scoreCase(testCase, hits, MIN_SCORE);

    expect(result.matchedRank).toBe(3);
    expect(result.keptRank).toBe(2);
    expect(result.recallAt3).toBe(true);
  });

  test('handles an empty hit list', () => {
    const testCase: RagEvalCase = {
      name: 'empty',
      query: 'q',
      expectedFactIds: ['fact_a'],
    };

    const result = scoreCase(testCase, [], MIN_SCORE);

    expect(result.status).toBe('miss');
    expect(result.recallAt5).toBe(false);
  });
});

describe('summarizeResults', () => {
  function result(overrides: Partial<RagEvalCaseResult>): RagEvalCaseResult {
    return {
      name: 'x',
      query: 'q',
      expectedFactIds: ['fact_a'],
      hits: [],
      matchedRank: null,
      matchedScore: null,
      keptRank: null,
      status: 'miss',
      recallAt1: false,
      recallAt3: false,
      recallAt5: false,
      ...overrides,
    };
  }

  test('computes recall@k percentages rounded to 1 decimal', () => {
    const results = [
      result({
        recallAt1: true,
        recallAt3: true,
        recallAt5: true,
        matchedRank: 1,
        matchedScore: 0.9,
        status: 'hit',
      }),
      result({
        recallAt1: false,
        recallAt3: true,
        recallAt5: true,
        matchedRank: 2,
        matchedScore: 0.8,
        status: 'hit',
      }),
      result({
        recallAt1: false,
        recallAt3: false,
        recallAt5: false,
        status: 'miss',
      }),
    ];

    const summary = summarizeResults(results);

    expect(summary.totalCases).toBe(3);
    expect(summary.recallAt1).toBeCloseTo(33.3, 1);
    expect(summary.recallAt3).toBeCloseTo(66.7, 1);
    expect(summary.recallAt5).toBeCloseTo(66.7, 1);
    expect(summary.foundCount).toBe(2);
    expect(summary.missCount).toBe(1);
    expect(summary.meanMatchedScore).toBeCloseTo(0.85, 3);
  });

  test('mean score only averages over cases that retrieved their fact at all', () => {
    const results = [
      result({ matchedScore: 0.6, matchedRank: 3, status: 'below-threshold' }),
      result({ matchedScore: null, matchedRank: null, status: 'miss' }),
    ];

    const summary = summarizeResults(results);

    expect(summary.meanMatchedScore).toBe(0.6);
  });

  test('reports meanMatchedScore as null when no case ever retrieved its fact', () => {
    const summary = summarizeResults([result({}), result({})]);
    expect(summary.meanMatchedScore).toBeNull();
  });

  test('handles an empty result list without dividing by zero', () => {
    const summary = summarizeResults([]);
    expect(summary.totalCases).toBe(0);
    expect(summary.recallAt1).toBe(0);
    expect(summary.meanMatchedScore).toBeNull();
  });
});

describe('formatResultsTable', () => {
  test('surfaces a MISS clearly for a fact that never appears in topK', () => {
    const testCase: RagEvalCase = {
      name: 'leadership — roles held',
      query: 'what leadership roles',
      expectedFactIds: ['fact_president'],
    };
    const result = scoreCase(testCase, [fact('fact_other', 0.9)], MIN_SCORE);

    const lines = formatResultsTable([result]);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('MISS');
    expect(lines[0]).toContain('leadership — roles held');
  });

  test('surfaces BELOW-THRESHOLD distinctly from MISS and HIT', () => {
    const testCase: RagEvalCase = {
      name: 'leadership',
      query: 'q',
      expectedFactIds: ['fact_president'],
    };
    const result = scoreCase(
      testCase,
      [fact('fact_other', 0.9), fact('fact_president', 0.6)],
      MIN_SCORE,
    );

    const [line] = formatResultsTable([result]);
    expect(line).toContain('BELOW-THRESHOLD');
    expect(line).toContain('0.600');
  });

  test('surfaces HIT with its kept rank', () => {
    const testCase: RagEvalCase = {
      name: 'education',
      query: 'q',
      expectedFactIds: ['fact_a'],
    };
    const result = scoreCase(testCase, [fact('fact_a', 0.9)], MIN_SCORE);

    const [line] = formatResultsTable([result]);
    expect(line).toContain('HIT');
    expect(line).toContain('#1');
  });
});

describe('formatSummary', () => {
  test('renders recall@k and the found/miss breakdown', () => {
    const lines = formatSummary({
      totalCases: 10,
      recallAt1: 50,
      recallAt3: 80,
      recallAt5: 90,
      meanMatchedScore: 0.812,
      foundCount: 9,
      missCount: 1,
    });
    const joined = lines.join('\n');

    expect(joined).toContain('recall@1: 50%');
    expect(joined).toContain('recall@3: 80%');
    expect(joined).toContain('recall@5: 90%');
    expect(joined).toContain('0.812');
    expect(joined).toContain('9 retrieved at all');
    expect(joined).toContain('1 never appeared in topK');
  });

  test('renders an explicit n/a when no fact was ever retrieved', () => {
    const lines = formatSummary({
      totalCases: 2,
      recallAt1: 0,
      recallAt3: 0,
      recallAt5: 0,
      meanMatchedScore: null,
      foundCount: 0,
      missCount: 2,
    });

    expect(lines.join('\n')).toContain('n/a');
  });
});
