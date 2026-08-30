import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { formatRagTrace, RAG_MIN_SCORE, type RagQueryResult } from './rag';

const ENV_KEYS = [
  'UPSTASH_VECTOR_REST_URL',
  'UPSTASH_VECTOR_REST_TOKEN',
] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.resetModules();
});

test('formatRagTrace reports no retrieval yet when trace is null', () => {
  const lines = formatRagTrace(null);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/no retrieval yet/i);
});

test('formatRagTrace lists kept and filtered-out candidates with scores', () => {
  const trace: RagQueryResult = {
    query: 'What leadership roles does Jared hold?',
    facts: [
      { id: 'a', text: 'President of GDG on Campus CIT-U.', score: 0.81 },
    ],
    filteredOut: [
      {
        id: 'b',
        text: 'Chapter operations lead for AWS Cloud Club.',
        score: 0.62,
      },
    ],
  };
  const lines = formatRagTrace(trace);
  const joined = lines.join('\n');

  expect(joined).toContain(trace.query);
  expect(joined).toContain(`kept (score >= ${RAG_MIN_SCORE}):`);
  expect(joined).toContain('[0.810] President of GDG on Campus CIT-U.');
  expect(joined).toContain('filtered out (below threshold):');
  expect(joined).toContain(
    '[0.620] Chapter operations lead for AWS Cloud Club.',
  );
});

test('formatRagTrace labels empty kept/filtered-out lists explicitly', () => {
  const trace: RagQueryResult = {
    query: 'irrelevant query',
    facts: [],
    filteredOut: [],
  };
  const lines = formatRagTrace(trace);
  const joined = lines.join('\n');

  expect(joined).toContain('(none — nothing cleared the relevance threshold)');
  expect(joined).toContain('(none)');
});

test('getVectorIndex throws naming the missing token', async () => {
  delete process.env.UPSTASH_VECTOR_REST_TOKEN;
  process.env.UPSTASH_VECTOR_REST_URL = 'https://example.upstash.io';
  vi.resetModules();
  const { getVectorIndex } = await import('./rag');

  expect(() => getVectorIndex()).toThrow(/UPSTASH_VECTOR_REST_TOKEN/);
});

test('getVectorIndex throws naming the missing url', async () => {
  delete process.env.UPSTASH_VECTOR_REST_URL;
  process.env.UPSTASH_VECTOR_REST_TOKEN = 'test-token';
  vi.resetModules();
  const { getVectorIndex } = await import('./rag');

  expect(() => getVectorIndex()).toThrow(/UPSTASH_VECTOR_REST_URL/);
});

test('getVectorIndex memoizes the client across repeated calls', async () => {
  process.env.UPSTASH_VECTOR_REST_URL = 'https://example.upstash.io';
  process.env.UPSTASH_VECTOR_REST_TOKEN = 'test-token';
  vi.resetModules();
  const { getVectorIndex } = await import('./rag');

  const first = getVectorIndex();
  const second = getVectorIndex();
  expect(second).toBe(first);
});
