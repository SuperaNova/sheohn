// Pure, unit-testable logic for the weekly eval scoreboard (sonnet-specs/05).
//
// `scripts/transform-eval-results.ts` and `scripts/check-eval-regression.ts`
// are thin CLI wrappers around the functions in this file — file I/O and
// process.env/argv parsing live in the scripts, everything else lives here
// so it's covered by the `src/**` vitest include glob.

/** A single test-case outcome, normalized from Playwright's JSON reporter. */
type EvalCaseStatus = 'passed' | 'failed' | 'skipped';

export type EvalCaseResult = {
  name: string;
  status: EvalCaseStatus;
  durationMs: number;
  error?: string;
};

/** Full per-case detail for one run, written to `data/eval-history/<date>.json`. */
export type EvalRunDetail = {
  date: string; // ISO date, e.g. "2026-07-06"
  commitSha: string;
  cases: EvalCaseResult[];
};

/**
 * Rollup for one run — this is the shape appended to `index.json`'s `runs`
 * array AND mirrored (as the single newest entry) in its top-level `latest`
 * field. `passRate` is a percentage (0-100), rounded to 1 decimal place, so
 * a shields.io dynamic-JSON badge can display it directly with `suffix=%25`.
 */
export type EvalSummaryEntry = {
  date: string;
  commitSha: string;
  passRate: number;
  totalCases: number;
  passedCases: number;
};

/**
 * `data/eval-history/index.json`'s shape.
 *
 * `latest` mirrors the newest entry of `runs` (or `null` before the first
 * run has ever completed — the seed file ships with `{ latest: null, runs:
 * [] }`). It exists so the README's shields.io dynamic-JSON badge (and
 * spec #10's future status page) can point a stable JSONPath
 * (`$.latest.passRate`) at "the current number" instead of "the last
 * element of a growing array", which shields' dynamic/json badge query
 * language (JSONPath-Plus) can't express robustly as the array grows.
 */
export type EvalHistoryIndex = {
  latest: EvalSummaryEntry | null;
  runs: EvalSummaryEntry[];
};

export function createEmptyIndex(): EvalHistoryIndex {
  return { latest: null, runs: [] };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Derives the summary rollup (pass rate etc.) from a run's per-case results. */
export function summarizeCases(
  cases: EvalCaseResult[],
): Pick<EvalSummaryEntry, 'passRate' | 'totalCases' | 'passedCases'> {
  const totalCases = cases.length;
  const passedCases = cases.filter((c) => c.status === 'passed').length;
  const passRate =
    totalCases === 0 ? 0 : round1((passedCases / totalCases) * 100);
  return { passRate, totalCases, passedCases };
}

/** Builds the summary entry appended to `index.json` for a completed run. */
export function summarizeRun(detail: EvalRunDetail): EvalSummaryEntry {
  return {
    date: detail.date,
    commitSha: detail.commitSha,
    ...summarizeCases(detail.cases),
  };
}

/** Appends a new summary entry and refreshes `latest` to mirror it. */
export function appendSummary(
  index: EvalHistoryIndex,
  entry: EvalSummaryEntry,
): EvalHistoryIndex {
  return {
    latest: entry,
    runs: [...index.runs, entry],
  };
}

// ---------------------------------------------------------------------------
// Playwright JSON reporter parsing
// ---------------------------------------------------------------------------

/**
 * Minimal subset of Playwright's JSON reporter output
 * (`@playwright/test`'s `JSONReport*` types) that this module reads.
 * Only the fields actually consumed are declared.
 */
type PlaywrightJsonTestResult = {
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;
  error?: { message?: string };
  errors?: { message?: string }[];
};

type PlaywrightJsonTest = {
  // Playwright's post-retry verdict for the test as a whole.
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  results: PlaywrightJsonTestResult[];
};

type PlaywrightJsonSpec = {
  title: string;
  tests: PlaywrightJsonTest[];
};

type PlaywrightJsonSuite = {
  title: string;
  specs?: PlaywrightJsonSpec[];
  suites?: PlaywrightJsonSuite[];
};

export type PlaywrightJsonReport = {
  suites: PlaywrightJsonSuite[];
};

function flattenSpecs(
  suites: PlaywrightJsonSuite[] | undefined,
): PlaywrightJsonSpec[] {
  if (!suites) return [];
  const specs: PlaywrightJsonSpec[] = [];
  for (const suite of suites) {
    if (suite.specs) specs.push(...suite.specs);
    if (suite.suites) specs.push(...flattenSpecs(suite.suites));
  }
  return specs;
}

/**
 * Converts a Playwright JSON report into per-case results.
 *
 * `tests/eval/agent.eval.ts` declares one `test()` per golden case with no
 * nested `describe` blocks, so each spec's `title` is exactly the eval
 * case's `name` (see `tests/eval/cases.ts`) — this is what
 * `findRegressedCases` below matches on.
 *
 * A test's overall `status` ('expected' | 'unexpected' | 'flaky' | 'skipped')
 * already reflects Playwright's retry logic (`retries: 1` in
 * `playwright.eval.config.ts`): 'flaky' means it failed then passed on
 * retry, so it counts as passed here — only 'unexpected' (failed even after
 * retries) counts as a failure.
 */
export function extractCaseResults(
  report: PlaywrightJsonReport,
): EvalCaseResult[] {
  const specs = flattenSpecs(report.suites);
  const results: EvalCaseResult[] = [];

  for (const spec of specs) {
    for (const test of spec.tests) {
      const status: EvalCaseStatus =
        test.status === 'unexpected'
          ? 'failed'
          : test.status === 'skipped'
            ? 'skipped'
            : 'passed';

      const durationMs = test.results.reduce(
        (sum, r) => sum + (r.duration ?? 0),
        0,
      );

      let error: string | undefined;
      if (status === 'failed') {
        const lastResult = test.results[test.results.length - 1];
        error = lastResult?.error?.message ?? lastResult?.errors?.[0]?.message;
      }

      results.push({
        name: spec.title,
        status,
        durationMs,
        ...(error ? { error } : {}),
      });
    }
  }

  return results;
}

export function buildEvalRunDetail(
  report: PlaywrightJsonReport,
  meta: { date: string; commitSha: string },
): EvalRunDetail {
  return {
    date: meta.date,
    commitSha: meta.commitSha,
    cases: extractCaseResults(report),
  };
}

// ---------------------------------------------------------------------------
// Regression diff
// ---------------------------------------------------------------------------

/**
 * Returns the names of cases that passed in `previous` but did not pass in
 * `current` (matched by case name). Cases absent from `previous` (newly
 * added golden cases) are never reported as regressions.
 */
export function findRegressedCases(
  previous: EvalRunDetail,
  current: EvalRunDetail,
): string[] {
  const previousStatusByName = new Map(
    previous.cases.map((c) => [c.name, c.status]),
  );

  const regressed = current.cases
    .filter(
      (c) =>
        previousStatusByName.get(c.name) === 'passed' && c.status !== 'passed',
    )
    .map((c) => c.name);

  return regressed.sort();
}
