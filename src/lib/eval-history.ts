// Pure logic for the weekly eval scoreboard; the scripts/ CLIs wrap it.
// Lives under src/ so vitest's `src/**` include glob covers it.
import { isInfraErrorMessage } from './eval-infra';

/** A single test-case outcome, normalized from Playwright's JSON reporter. */
/** 'errored' = upstream infrastructure failure; absent from history written before it existed. */
type EvalCaseStatus = 'passed' | 'failed' | 'skipped' | 'errored';

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

/** Per-run rollup; `passRate` is a 0-100 percentage rounded to 1 decimal (shields.io badge). */
export type EvalSummaryEntry = {
  date: string;
  commitSha: string;
  passRate: number;
  totalCases: number;
  passedCases: number;
  /** Infra-errored cases, excluded from `totalCases`/`passRate`; omitted when zero. */
  erroredCases?: number;
};

/**
 * `data/eval-history/index.json`. `latest` mirrors the newest run (null before the first)
 * so a badge can target the stable path `$.latest.passRate`.
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

/**
 * Derives the summary rollup (pass rate etc.) from a run's per-case results.
 * Errored cases are left out of the denominator: they say nothing about the agent.
 */
export function summarizeCases(
  cases: EvalCaseResult[],
): Pick<
  EvalSummaryEntry,
  'passRate' | 'totalCases' | 'passedCases' | 'erroredCases'
> {
  const erroredCases = cases.filter((c) => c.status === 'errored').length;
  const totalCases = cases.length - erroredCases;
  const passedCases = cases.filter((c) => c.status === 'passed').length;
  const passRate =
    totalCases === 0 ? 0 : round1((passedCases / totalCases) * 100);
  return {
    passRate,
    totalCases,
    passedCases,
    ...(erroredCases > 0 ? { erroredCases } : {}),
  };
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

/** Minimal subset of Playwright's JSON reporter output that this module reads. */
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
 * Converts a Playwright JSON report into per-case results; spec title is the eval case name.
 * 'flaky' (failed, then passed on retry) counts as passed; only 'unexpected' fails.
 */
export function extractCaseResults(
  report: PlaywrightJsonReport,
): EvalCaseResult[] {
  const specs = flattenSpecs(report.suites);
  const results: EvalCaseResult[] = [];

  for (const spec of specs) {
    for (const test of spec.tests) {
      const baseStatus: EvalCaseStatus =
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
      if (baseStatus === 'failed') {
        const lastResult = test.results[test.results.length - 1];
        error = lastResult?.error?.message ?? lastResult?.errors?.[0]?.message;
      }
      const status: EvalCaseStatus =
        baseStatus === 'failed' && isInfraErrorMessage(error)
          ? 'errored'
          : baseStatus;

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

type EvalBaseline = { status: EvalCaseStatus; date: string };

/**
 * Per-case baseline from prior runs (oldest first): the most recent status that
 * isn't 'errored', so an infra-errored week doesn't hide an earlier pass.
 */
function buildBaselines(priorRuns: EvalRunDetail[]): Map<string, EvalBaseline> {
  const baselines = new Map<string, EvalBaseline>();
  for (const run of priorRuns) {
    for (const c of run.cases) {
      if (c.status !== 'errored') {
        baselines.set(c.name, { status: c.status, date: run.date });
      }
    }
  }
  return baselines;
}

/** Cases whose baseline was 'passed' but are now failed or skipped; errored and new cases never count. */
export function findRegressions(
  priorRuns: EvalRunDetail[],
  current: EvalRunDetail,
): { name: string; baselineDate: string }[] {
  const baselines = buildBaselines(priorRuns);
  return current.cases
    .filter(
      (c) =>
        baselines.get(c.name)?.status === 'passed' &&
        c.status !== 'passed' &&
        c.status !== 'errored',
    )
    .map((c) => ({ name: c.name, baselineDate: baselines.get(c.name)!.date }))
    .sort((x, y) => x.name.localeCompare(y.name));
}

export function findRegressedCases(
  priorRuns: EvalRunDetail[],
  current: EvalRunDetail,
): string[] {
  return findRegressions(priorRuns, current).map((r) => r.name);
}

/**
 * Flags regressions plus an absolute pass-rate floor, so a first run (no prior runs)
 * can still fail.
 */
export type EvalHealthCheck = {
  regressedCases: string[];
  /** Date of each regressed case's last scored baseline run. */
  baselineDates: Record<string, string>;
  erroredCases: string[];
  /** True when every case errored, so nothing was scored and the floor is not applied. */
  inconclusive: boolean;
  /** True when more than half the cases errored, which usually means something systemic. */
  systemicInfra: boolean;
  passRate: number;
  floor: number;
  floorBreached: boolean;
  flagged: boolean;
};

export function checkEvalHealth(
  current: EvalRunDetail,
  priorRuns: EvalRunDetail[],
  floor: number,
): EvalHealthCheck {
  const regressions = findRegressions(priorRuns, current);
  const regressedCases = regressions.map((r) => r.name);
  const {
    passRate,
    totalCases,
    erroredCases: erroredCount = 0,
  } = summarizeCases(current.cases);
  const inconclusive = totalCases === 0 && current.cases.length > 0;
  const systemicInfra = erroredCount * 2 > current.cases.length;
  const floorBreached = !inconclusive && passRate < floor;
  const erroredCases = current.cases
    .filter((c) => c.status === 'errored')
    .map((c) => c.name)
    .sort();

  return {
    regressedCases,
    baselineDates: Object.fromEntries(
      regressions.map((r) => [r.name, r.baselineDate]),
    ),
    erroredCases,
    inconclusive,
    systemicInfra,
    passRate,
    floor,
    floorBreached,
    flagged: regressedCases.length > 0 || floorBreached || systemicInfra,
  };
}
