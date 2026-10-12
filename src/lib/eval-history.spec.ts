import { describe, expect, test } from 'vitest';
import {
  appendSummary,
  buildEvalRunDetail,
  checkEvalHealth,
  createEmptyIndex,
  extractCaseResults,
  findRegressedCases,
  findRegressions,
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

    expect(findRegressedCases([previous], current)).toEqual([
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

    expect(findRegressedCases([previous], current)).toEqual([]);
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

    expect(findRegressedCases([previous], current)).toEqual([]);
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

    expect(findRegressedCases([previous], current)).toEqual([]);
  });
});

describe('checkEvalHealth', () => {
  test('flags a run below the floor with no previous run', () => {
    const current: EvalRunDetail = {
      date: '2026-08-24',
      commitSha: 'a',
      cases: Array.from({ length: 10 }, (_, i) => ({
        name: `case ${i}`,
        status: 'failed' as const,
        durationMs: 10,
      })),
    };

    const result = checkEvalHealth(current, [], 70);
    expect(result.passRate).toBe(0);
    expect(result.floorBreached).toBe(true);
    expect(result.regressedCases).toEqual([]);
    expect(result.flagged).toBe(true);
  });

  test('flags a run below the floor even with a previous run and no flips', () => {
    const previous: EvalRunDetail = {
      date: '2026-08-17',
      commitSha: 'a',
      cases: [
        { name: 'a', status: 'passed', durationMs: 10 },
        { name: 'b', status: 'failed', durationMs: 10 },
      ],
    };
    const current: EvalRunDetail = {
      date: '2026-08-24',
      commitSha: 'b',
      cases: [
        { name: 'a', status: 'passed', durationMs: 10 },
        { name: 'b', status: 'failed', durationMs: 10 },
      ],
    };

    const result = checkEvalHealth(current, [previous], 70);
    expect(result.passRate).toBe(50);
    expect(result.floorBreached).toBe(true);
    expect(result.regressedCases).toEqual([]);
    expect(result.flagged).toBe(true);
  });

  test('reports both a regression and a floor breach when the run has both', () => {
    const previous: EvalRunDetail = {
      date: '2026-08-17',
      commitSha: 'a',
      cases: [
        { name: 'a', status: 'passed', durationMs: 10 },
        { name: 'b', status: 'passed', durationMs: 10 },
      ],
    };
    const current: EvalRunDetail = {
      date: '2026-08-24',
      commitSha: 'b',
      cases: [
        { name: 'a', status: 'failed', durationMs: 10 },
        { name: 'b', status: 'passed', durationMs: 10 },
      ],
    };

    const result = checkEvalHealth(current, [previous], 70);
    expect(result.regressedCases).toEqual(['a']);
    expect(result.floorBreached).toBe(true);
    expect(result.flagged).toBe(true);
  });

  test('does not flag a run at or above the floor with no regressions', () => {
    const previous: EvalRunDetail = {
      date: '2026-08-17',
      commitSha: 'a',
      cases: [
        { name: 'a', status: 'passed', durationMs: 10 },
        { name: 'b', status: 'passed', durationMs: 10 },
      ],
    };
    const current: EvalRunDetail = {
      date: '2026-08-24',
      commitSha: 'b',
      cases: [
        { name: 'a', status: 'passed', durationMs: 10 },
        { name: 'b', status: 'passed', durationMs: 10 },
      ],
    };

    const result = checkEvalHealth(current, [previous], 70);
    expect(result.passRate).toBe(100);
    expect(result.floorBreached).toBe(false);
    expect(result.flagged).toBe(false);
  });

  test('an overridden floor can flip the verdict for the same pass rate', () => {
    const current: EvalRunDetail = {
      date: '2026-08-24',
      commitSha: 'a',
      cases: [
        { name: 'a', status: 'passed', durationMs: 10 },
        { name: 'b', status: 'passed', durationMs: 10 },
        { name: 'c', status: 'passed', durationMs: 10 },
        { name: 'd', status: 'failed', durationMs: 10 },
      ],
    };

    expect(checkEvalHealth(current, [], 70).floorBreached).toBe(false);
    expect(checkEvalHealth(current, [], 90).floorBreached).toBe(true);
  });
});

describe('errored cases', () => {
  const infraMessage = 'apiRequestContext.post: Request context disposed.';

  function reportWith(message: string): PlaywrightJsonReport {
    return {
      suites: [
        {
          title: 'agent.eval.ts',
          specs: [
            {
              title: 'case a',
              tests: [
                {
                  status: 'unexpected',
                  results: [
                    { status: 'failed', duration: 5, error: { message } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  test('extractCaseResults classifies infra failures as errored', () => {
    expect(extractCaseResults(reportWith(infraMessage))[0]?.status).toBe(
      'errored',
    );
    expect(
      extractCaseResults(reportWith('[infra] HTTP 503: overloaded'))[0]?.status,
    ).toBe('errored');
  });

  test('extractCaseResults keeps assertion failures as failed', () => {
    expect(
      extractCaseResults(reportWith('expected no tool call'))[0]?.status,
    ).toBe('failed');
  });

  test('summarizeCases excludes errored cases from the denominator', () => {
    expect(
      summarizeCases([
        { name: 'a', status: 'passed', durationMs: 1 },
        { name: 'b', status: 'errored', durationMs: 1 },
      ]),
    ).toEqual({
      passRate: 100,
      totalCases: 1,
      passedCases: 1,
      erroredCases: 1,
    });
  });

  test('findRegressedCases ignores a passed-to-errored flip', () => {
    const previous: EvalRunDetail = {
      date: 'p',
      commitSha: 'a',
      cases: [
        { name: 'a', status: 'passed', durationMs: 1 },
        { name: 'b', status: 'passed', durationMs: 1 },
      ],
    };
    const current: EvalRunDetail = {
      date: 'c',
      commitSha: 'b',
      cases: [
        { name: 'a', status: 'errored', durationMs: 1 },
        { name: 'b', status: 'failed', durationMs: 1 },
      ],
    };
    expect(findRegressedCases([previous], current)).toEqual(['b']);
  });

  test('findRegressedCases ignores an errored-to-failed flip', () => {
    const previous: EvalRunDetail = {
      date: 'p',
      commitSha: 'a',
      cases: [{ name: 'a', status: 'errored', durationMs: 1 }],
    };
    const current: EvalRunDetail = {
      date: 'c',
      commitSha: 'b',
      cases: [{ name: 'a', status: 'failed', durationMs: 1 }],
    };
    expect(findRegressedCases([previous], current)).toEqual([]);
  });

  test('checkEvalHealth does not let errored cases flag or breach the floor', () => {
    const previous: EvalRunDetail = {
      date: 'p',
      commitSha: 'a',
      cases: [
        { name: 'a', status: 'passed', durationMs: 1 },
        { name: 'b', status: 'passed', durationMs: 1 },
        { name: 'c', status: 'passed', durationMs: 1 },
      ],
    };
    const current: EvalRunDetail = {
      date: 'c',
      commitSha: 'b',
      cases: [
        { name: 'a', status: 'passed', durationMs: 1 },
        { name: 'b', status: 'errored', durationMs: 1 },
        { name: 'c', status: 'passed', durationMs: 1 },
      ],
    };
    const result = checkEvalHealth(current, [previous], 70);
    expect(result.passRate).toBe(100);
    expect(result.erroredCases).toEqual(['b']);
    expect(result.flagged).toBe(false);
  });

  test('checkEvalHealth flags a run where more than half the cases errored as systemic', () => {
    const current: EvalRunDetail = {
      date: 'c',
      commitSha: 'b',
      cases: [
        { name: 'a', status: 'passed', durationMs: 1 },
        { name: 'b', status: 'errored', durationMs: 1 },
        { name: 'c', status: 'errored', durationMs: 1 },
      ],
    };
    const result = checkEvalHealth(current, [], 70);
    expect(result.systemicInfra).toBe(true);
    expect(result.inconclusive).toBe(false);
    expect(result.flagged).toBe(true);
  });

  test('checkEvalHealth does not flag exactly half errored', () => {
    const current: EvalRunDetail = {
      date: 'c',
      commitSha: 'b',
      cases: [
        { name: 'a', status: 'passed', durationMs: 1 },
        { name: 'b', status: 'errored', durationMs: 1 },
      ],
    };
    expect(checkEvalHealth(current, [], 70).flagged).toBe(false);
  });

  test('checkEvalHealth treats an all-errored run as inconclusive, not a floor breach', () => {
    const current: EvalRunDetail = {
      date: 'c',
      commitSha: 'b',
      cases: [{ name: 'a', status: 'errored', durationMs: 1 }],
    };
    const result = checkEvalHealth(current, [], 70);
    expect(result.inconclusive).toBe(true);
    expect(result.floorBreached).toBe(false);
    expect(result.systemicInfra).toBe(true);
    expect(result.flagged).toBe(true);
  });
});

describe('baseline across errored runs', () => {
  const run = (
    date: string,
    status: 'passed' | 'failed' | 'errored',
  ): EvalRunDetail => ({
    date,
    commitSha: date,
    cases: [{ name: 'a', status, durationMs: 1 }],
  });

  test('passed -> errored -> failed is flagged against the passed run', () => {
    expect(
      findRegressions(
        [run('w1', 'passed'), run('w2', 'errored')],
        run('w3', 'failed'),
      ),
    ).toEqual([{ name: 'a', baselineDate: 'w1' }]);
  });

  test('passed -> errored -> passed is not flagged', () => {
    expect(
      findRegressions(
        [run('w1', 'passed'), run('w2', 'errored')],
        run('w3', 'passed'),
      ),
    ).toEqual([]);
  });

  test('a scored failure after a pass resets the baseline', () => {
    expect(
      findRegressions(
        [run('w1', 'passed'), run('w2', 'failed'), run('w3', 'errored')],
        run('w4', 'failed'),
      ),
    ).toEqual([]);
  });

  test('no prior runs (missing history) flags nothing', () => {
    expect(findRegressions([], run('w1', 'failed'))).toEqual([]);
  });

  test('checkEvalHealth reports the baseline date per regressed case', () => {
    const health = checkEvalHealth(
      run('w3', 'failed'),
      [run('w1', 'passed'), run('w2', 'errored')],
      0,
    );
    expect(health.regressedCases).toEqual(['a']);
    expect(health.baselineDates).toEqual({ a: 'w1' });
  });
});
