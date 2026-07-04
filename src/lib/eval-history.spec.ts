import { describe, expect, test } from 'vitest';
import {
  appendSummary,
  buildEvalRunDetail,
  createEmptyIndex,
  extractCaseResults,
  findRegressedCases,
  summarizeCases,
  summarizeRun,
  type EvalRunDetail,
  type PlaywrightJsonReport,
} from './eval-history';

describe('summarizeCases', () => {
  test('computes pass rate rounded to 1 decimal place', () => {
    const summary = summarizeCases([
      { name: 'a', status: 'passed', durationMs: 10 },
      { name: 'b', status: 'passed', durationMs: 10 },
      { name: 'c', status: 'failed', durationMs: 10 },
    ]);

    expect(summary).toEqual({ passRate: 66.7, totalCases: 3, passedCases: 2 });
  });

  test('handles an empty case list without dividing by zero', () => {
    expect(summarizeCases([])).toEqual({
      passRate: 0,
      totalCases: 0,
      passedCases: 0,
    });
  });

  test('treats skipped cases as not-passed', () => {
    const summary = summarizeCases([
      { name: 'a', status: 'passed', durationMs: 10 },
      { name: 'b', status: 'skipped', durationMs: 0 },
    ]);
    expect(summary).toEqual({ passRate: 50, totalCases: 2, passedCases: 1 });
  });
});

describe('summarizeRun / appendSummary / createEmptyIndex', () => {
  test('createEmptyIndex seeds latest: null, runs: []', () => {
    expect(createEmptyIndex()).toEqual({ latest: null, runs: [] });
  });

  test('appendSummary appends to runs and mirrors the entry in latest', () => {
    const detail: EvalRunDetail = {
      date: '2026-07-06',
      commitSha: 'abc123',
      cases: [
        { name: 'a', status: 'passed', durationMs: 10 },
        { name: 'b', status: 'passed', durationMs: 10 },
      ],
    };
    const entry = summarizeRun(detail);
    const index = appendSummary(createEmptyIndex(), entry);

    expect(index.runs).toEqual([entry]);
    expect(index.latest).toEqual(entry);

    // Appending a second entry keeps history and re-mirrors `latest`.
    const secondEntry = summarizeRun({ ...detail, date: '2026-07-13' });
    const secondIndex = appendSummary(index, secondEntry);
    expect(secondIndex.runs).toEqual([entry, secondEntry]);
    expect(secondIndex.latest).toEqual(secondEntry);
  });
});

describe('extractCaseResults', () => {
  test('parses a Playwright JSON report into per-case results', () => {
    const report: PlaywrightJsonReport = {
      suites: [
        {
          title: 'agent.eval.ts',
          specs: [
            {
              title: 'open_case_study — named project',
              tests: [
                {
                  status: 'expected',
                  results: [{ status: 'passed', duration: 1234 }],
                },
              ],
            },
            {
              title: 'plain conversation — off-topic decline',
              tests: [
                {
                  status: 'unexpected',
                  results: [
                    {
                      status: 'failed',
                      duration: 500,
                      error: { message: 'first try' },
                    },
                    {
                      status: 'failed',
                      duration: 600,
                      error: { message: 'expected no tool call' },
                    },
                  ],
                },
              ],
            },
            {
              title: 'flaky-but-ultimately-passed case',
              tests: [
                {
                  status: 'flaky',
                  results: [
                    {
                      status: 'failed',
                      duration: 300,
                      error: { message: 'transient' },
                    },
                    { status: 'passed', duration: 400 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const results = extractCaseResults(report);

    expect(results).toEqual([
      {
        name: 'open_case_study — named project',
        status: 'passed',
        durationMs: 1234,
      },
      {
        name: 'plain conversation — off-topic decline',
        status: 'failed',
        durationMs: 1100,
        error: 'expected no tool call',
      },
      {
        name: 'flaky-but-ultimately-passed case',
        status: 'passed',
        durationMs: 700,
      },
    ]);
  });

  test('flattens specs nested under describe-block suites', () => {
    const report: PlaywrightJsonReport = {
      suites: [
        {
          title: 'agent.eval.ts',
          suites: [
            {
              title: 'nested describe',
              specs: [
                {
                  title: 'nested case',
                  tests: [
                    {
                      status: 'expected',
                      results: [{ status: 'passed', duration: 1 }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractCaseResults(report)).toEqual([
      { name: 'nested case', status: 'passed', durationMs: 1 },
    ]);
  });
});

describe('buildEvalRunDetail', () => {
  test('attaches date/commitSha metadata to the parsed cases', () => {
    const report: PlaywrightJsonReport = {
      suites: [
        {
          title: 'agent.eval.ts',
          specs: [
            {
              title: 'a',
              tests: [
                {
                  status: 'expected',
                  results: [{ status: 'passed', duration: 1 }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(
      buildEvalRunDetail(report, { date: '2026-07-06', commitSha: 'deadbeef' }),
    ).toEqual({
      date: '2026-07-06',
      commitSha: 'deadbeef',
      cases: [{ name: 'a', status: 'passed', durationMs: 1 }],
    });
  });
});

describe('findRegressedCases', () => {
  test('reports a case that passed previously and fails now', () => {
    const previous: EvalRunDetail = {
      date: '2026-07-06',
      commitSha: 'a',
      cases: [
        {
          name: 'open_case_study — named project',
          status: 'passed',
          durationMs: 10,
        },
        { name: 'set_theme — dark mode', status: 'passed', durationMs: 10 },
      ],
    };
    const current: EvalRunDetail = {
      date: '2026-07-13',
      commitSha: 'b',
      cases: [
        {
          name: 'open_case_study — named project',
          status: 'passed',
          durationMs: 10,
        },
        {
          name: 'set_theme — dark mode',
          status: 'failed',
          durationMs: 10,
          error: 'tool call missing',
        },
      ],
    };

    expect(findRegressedCases(previous, current)).toEqual([
      'set_theme — dark mode',
    ]);
  });

  test('does not report cases that were already failing (no flip)', () => {
    const previous: EvalRunDetail = {
      date: '2026-07-06',
      commitSha: 'a',
      cases: [{ name: 'x', status: 'failed', durationMs: 10 }],
    };
    const current: EvalRunDetail = {
      date: '2026-07-13',
      commitSha: 'b',
      cases: [{ name: 'x', status: 'failed', durationMs: 10 }],
    };

    expect(findRegressedCases(previous, current)).toEqual([]);
  });

  test('does not report newly added cases with no prior history', () => {
    const previous: EvalRunDetail = {
      date: '2026-07-06',
      commitSha: 'a',
      cases: [],
    };
    const current: EvalRunDetail = {
      date: '2026-07-13',
      commitSha: 'b',
      cases: [{ name: 'new case', status: 'failed', durationMs: 10 }],
    };

    expect(findRegressedCases(previous, current)).toEqual([]);
  });

  test('returns an empty array when nothing regressed', () => {
    const previous: EvalRunDetail = {
      date: '2026-07-06',
      commitSha: 'a',
      cases: [{ name: 'x', status: 'passed', durationMs: 10 }],
    };
    const current: EvalRunDetail = {
      date: '2026-07-13',
      commitSha: 'b',
      cases: [{ name: 'x', status: 'passed', durationMs: 10 }],
    };

    expect(findRegressedCases(previous, current)).toEqual([]);
  });
});
