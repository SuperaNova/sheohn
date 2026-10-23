import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { RAG_MIN_SCORE } from './rag';
import {
  clearFactsCache,
  isFactsCached,
  searchFacts,
  type RagSearchDeps,
} from './rag-search';

function makeDeps(scores: number[]): RagSearchDeps {
  return {
    embedQuery: vi.fn(async () => [0.1, 0.2]),
    queryVectors: vi.fn(async () =>
      scores.map((score, i) => ({
        id: `fact-${i}`,
        score,
        metadata: { text: `text ${i}` },
      })),
    ),
  };
}

beforeEach(() => clearFactsCache());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('searchFacts', () => {
  test('splits hits at the score threshold', async () => {
    const deps = makeDeps([0.9, RAG_MIN_SCORE, RAG_MIN_SCORE - 0.01, 0.2]);
    const result = await searchFacts('stack', { deps });
    expect(result.query).toBe('stack');
    expect(result.facts.map((f) => f.id)).toEqual(['fact-0', 'fact-1']);
    expect(result.filteredOut.map((f) => f.id)).toEqual(['fact-2', 'fact-3']);
    expect(result.facts[0]).toEqual({
      id: 'fact-0',
      text: 'text 0',
      score: 0.9,
    });
  });

  test('a cache hit skips the embed and vector calls', async () => {
    const deps = makeDeps([0.9]);
    const onCacheEvent = vi.fn();
    const first = await searchFacts('Stack ', { deps, onCacheEvent });
    const second = await searchFacts('  stack', { deps, onCacheEvent });
    expect(second).toBe(first);
    expect(deps.embedQuery).toHaveBeenCalledTimes(1);
    expect(deps.queryVectors).toHaveBeenCalledTimes(1);
    expect(onCacheEvent.mock.calls).toEqual([['miss'], ['hit']]);
  });

  test('isFactsCached reflects the cache without searching', async () => {
    const deps = makeDeps([0.9]);
    expect(isFactsCached('stack')).toBe(false);
    await searchFacts('stack', { deps });
    expect(isFactsCached('STACK')).toBe(true);
  });

  test('a pipeline failure returns an empty result and is not cached', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deps: RagSearchDeps = {
      embedQuery: vi.fn(async () => {
        throw new Error('embed down');
      }),
      queryVectors: vi.fn(async () => []),
    };
    const pending = searchFacts('stack', { deps });
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({
      query: 'stack',
      facts: [],
      filteredOut: [],
    });
    expect(deps.embedQuery).toHaveBeenCalledTimes(3);
    expect(deps.queryVectors).not.toHaveBeenCalled();
    expect(isFactsCached('stack')).toBe(false);
  });

  test('retries a transient embed failure', async () => {
    vi.useFakeTimers();
    const embedQuery = vi
      .fn<RagSearchDeps['embedQuery']>()
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValue([0.1]);
    const deps: RagSearchDeps = { ...makeDeps([0.9]), embedQuery };
    const pending = searchFacts('stack', { deps });
    await vi.runAllTimersAsync();
    expect((await pending).facts).toHaveLength(1);
    expect(embedQuery).toHaveBeenCalledTimes(2);
  });
});
