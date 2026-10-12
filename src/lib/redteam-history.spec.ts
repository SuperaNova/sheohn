import { describe, expect, it } from 'vitest';
import {
  appendRedteamSummary,
  createEmptyRedteamIndex,
  summarizeRedteamResults,
  type PromptfooResultsFile,
} from './redteam-history';

const meta = { date: '2026-11-02', commitSha: 'abc123' };

function report(
  results: PromptfooResultsFile['results']['results'],
): PromptfooResultsFile {
  return { results: { results } };
}

describe('summarizeRedteamResults', () => {
  it('computes pass rate and per-plugin totals', () => {
    const entry = summarizeRedteamResults(
      report([
        { success: true, metadata: { pluginId: 'politics' } },
        {
          success: false,
          failureReason: 1,
          metadata: { pluginId: 'politics' },
        },
        { success: true, metadata: { pluginId: 'imitation' } },
      ]),
      meta,
    );
    expect(entry).toEqual({
      ...meta,
      passRate: 66.7,
      totalCases: 3,
      passedCases: 2,
      byPlugin: {
        politics: { passed: 1, total: 2 },
        imitation: { passed: 1, total: 1 },
      },
    });
  });

  it('excludes errored cases from totals and reports their count', () => {
    const entry = summarizeRedteamResults(
      report([
        { success: true, metadata: { pluginId: 'politics' } },
        { success: false, failureReason: 2, error: '[infra] HTTP 503' },
      ]),
      meta,
    );
    expect(entry.totalCases).toBe(1);
    expect(entry.passRate).toBe(100);
    expect(entry.erroredCases).toBe(1);
  });

  it('reads the plugin id from the test case when result metadata lacks it', () => {
    const entry = summarizeRedteamResults(
      report([
        { success: true, testCase: { metadata: { pluginId: 'pii:direct' } } },
      ]),
      meta,
    );
    expect(entry.byPlugin).toEqual({ 'pii:direct': { passed: 1, total: 1 } });
  });

  it('buckets cases with no plugin id under unknown', () => {
    const entry = summarizeRedteamResults(report([{ success: true }]), meta);
    expect(entry.byPlugin).toEqual({ unknown: { passed: 1, total: 1 } });
  });

  it('returns a zero pass rate when nothing was scored', () => {
    const entry = summarizeRedteamResults(
      report([{ success: false, failureReason: 2 }]),
      meta,
    );
    expect(entry.passRate).toBe(0);
    expect(entry.totalCases).toBe(0);
    expect(entry.erroredCases).toBe(1);
  });
});

describe('appendRedteamSummary', () => {
  it('appends the entry and mirrors it as latest', () => {
    const entry = summarizeRedteamResults(report([{ success: true }]), meta);
    const index = appendRedteamSummary(createEmptyRedteamIndex(), entry);
    expect(index.latest).toBe(entry);
    expect(index.runs).toEqual([entry]);
  });
});
