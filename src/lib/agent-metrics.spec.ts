import { describe, expect, test } from 'vitest';
import {
  AGENT_TOOL_NAMES,
  buildAgentStats,
  buildCacheStats,
  buildRequestStats,
  buildToolCallDistribution,
  collectToolNames,
  estimateLatencyPercentiles,
  isAgentToolName,
  latencyBucketFor,
} from './agent-metrics';

describe('isAgentToolName', () => {
  test('accepts every known tool name', () => {
    for (const name of AGENT_TOOL_NAMES) {
      expect(isAgentToolName(name)).toBe(true);
    }
  });

  test('rejects an unknown string', () => {
    expect(isAgentToolName('delete_everything')).toBe(false);
  });
});

describe('latencyBucketFor', () => {
  test('buckets at the documented edges', () => {
    expect(latencyBucketFor(0)).toBe('0-1000');
    expect(latencyBucketFor(999)).toBe('0-1000');
    expect(latencyBucketFor(1000)).toBe('1000-3000');
    expect(latencyBucketFor(3000)).toBe('3000-8000');
    expect(latencyBucketFor(8000)).toBe('8000-15000');
    expect(latencyBucketFor(15000)).toBe('15000+');
    expect(latencyBucketFor(60_000)).toBe('15000+');
  });
});

describe('estimateLatencyPercentiles', () => {
  test('returns zeroed percentiles for an empty histogram', () => {
    expect(estimateLatencyPercentiles({})).toEqual({ p50: 0, p95: 0 });
  });

  test('estimates within a single populated bucket', () => {
    const result = estimateLatencyPercentiles({ '1000-3000': 4 });
    expect(result.p50).toBeCloseTo(2000);
  });
});

describe('buildRequestStats', () => {
  test('computes rejection rate as a percentage', () => {
    expect(buildRequestStats(100, 10)).toEqual({
      total: 100,
      rejected: 10,
      rejectionRate: 10,
    });
  });

  test('is zero-safe with no requests', () => {
    expect(buildRequestStats(0, 0)).toEqual({
      total: 0,
      rejected: 0,
      rejectionRate: 0,
    });
  });
});

describe('buildCacheStats', () => {
  test('computes hit rate as a percentage', () => {
    expect(buildCacheStats(3, 1)).toEqual({ hits: 3, misses: 1, hitRate: 75 });
  });

  test('is zero-safe with no lookups recorded', () => {
    expect(buildCacheStats(0, 0)).toEqual({ hits: 0, misses: 0, hitRate: 0 });
  });
});

describe('buildToolCallDistribution', () => {
  test('fills in every known tool, defaulting missing ones to zero', () => {
    const result = buildToolCallDistribution({ open_resume: 5 });
    expect(result).toEqual(
      AGENT_TOOL_NAMES.map((name) => ({
        name,
        count: name === 'open_resume' ? 5 : 0,
      })),
    );
  });

  test('ignores unknown keys not in the tool set', () => {
    const result = buildToolCallDistribution({ not_a_real_tool: 99 });
    expect(result.every((t) => t.count === 0)).toBe(true);
  });
});

describe('collectToolNames', () => {
  test('flattens tool calls across steps in call order', () => {
    const steps = [
      { toolCalls: [{ toolName: 'query_jared_memory' }] },
      { toolCalls: [] },
      { toolCalls: [{ toolName: 'focus_section' }, { toolName: 'set_theme' }] },
    ];
    expect(collectToolNames(steps)).toEqual([
      'query_jared_memory',
      'focus_section',
      'set_theme',
    ]);
  });

  test('returns an empty list when no step called a tool', () => {
    expect(collectToolNames([{ toolCalls: [] }])).toEqual([]);
  });
});

describe('buildAgentStats', () => {
  test('assembles all four metrics from merged multi-day counts', () => {
    const stats = buildAgentStats({
      totalRequests: 50,
      rejectedRequests: 5,
      toolCounts: { open_case_study: 3, set_theme: 1 },
      latencyBuckets: { '1000-3000': 2, '3000-8000': 2 },
      cacheHits: 8,
      cacheMisses: 2,
    });

    expect(stats.requests).toEqual({
      total: 50,
      rejected: 5,
      rejectionRate: 10,
    });
    expect(stats.cache).toEqual({ hits: 8, misses: 2, hitRate: 80 });
    expect(
      stats.toolCalls.find((t) => t.name === 'open_case_study')?.count,
    ).toBe(3);
    expect(stats.latency.p50).toBeGreaterThan(0);
  });
});
