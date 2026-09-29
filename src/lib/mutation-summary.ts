// Pure logic for the weekly mutation-score badge; scripts/mutation-summary.ts wraps it for I/O.
// Field names mirror Stryker's mutation-testing-metrics.

type MutantStatus =
  | 'Killed'
  | 'Survived'
  | 'NoCoverage'
  | 'CompileError'
  | 'RuntimeError'
  | 'Timeout'
  | 'Ignored'
  | 'Pending';

interface StrykerMutant {
  status: MutantStatus;
}

/** Minimal subset of Stryker's mutation-testing-report-schema JSON this module reads. */
export interface StrykerMutationReport {
  files: Record<string, { mutants: StrykerMutant[] }>;
}

export interface MutationCounts {
  killed: number;
  survived: number;
  timeout: number;
  noCoverage: number;
  totalMutants: number;
}

/** Per-run rollup appended to `runs` and mirrored as `latest` (same convention as eval-history). */
export type MutationSummaryEntry = MutationCounts & {
  date: string;
  commitSha: string;
  mutationScore: number;
};

export interface MutationScoreIndex {
  latest: MutationSummaryEntry | null;
  runs: MutationSummaryEntry[];
}

export function createEmptyMutationIndex(): MutationScoreIndex {
  return { latest: null, runs: [] };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Counts mutants by status across every file in a Stryker JSON report. */
export function countMutants(report: StrykerMutationReport): MutationCounts {
  const counts: MutationCounts = {
    killed: 0,
    survived: 0,
    timeout: 0,
    noCoverage: 0,
    totalMutants: 0,
  };

  for (const file of Object.values(report.files)) {
    for (const mutant of file.mutants) {
      counts.totalMutants += 1;
      switch (mutant.status) {
        case 'Killed':
          counts.killed += 1;
          break;
        case 'Survived':
          counts.survived += 1;
          break;
        case 'Timeout':
          counts.timeout += 1;
          break;
        case 'NoCoverage':
          counts.noCoverage += 1;
          break;
        default:
          // CompileError/RuntimeError/Ignored/Pending are excluded from the score denominator.
          break;
      }
    }
  }

  return counts;
}

/** detected / valid * 100, matching Stryker's own mutation score formula. */
export function calculateMutationScore(counts: MutationCounts): number {
  const detected = counts.killed + counts.timeout;
  const valid = detected + counts.survived + counts.noCoverage;
  return valid === 0 ? 0 : round1((detected / valid) * 100);
}

export function buildMutationSummaryEntry(
  report: StrykerMutationReport,
  meta: { date: string; commitSha: string },
): MutationSummaryEntry {
  const counts = countMutants(report);
  return {
    date: meta.date,
    commitSha: meta.commitSha,
    mutationScore: calculateMutationScore(counts),
    ...counts,
  };
}

/** Appends a new summary entry and refreshes `latest` to mirror it. */
export function appendMutationSummary(
  index: MutationScoreIndex,
  entry: MutationSummaryEntry,
): MutationScoreIndex {
  return {
    latest: entry,
    runs: [...index.runs, entry],
  };
}
