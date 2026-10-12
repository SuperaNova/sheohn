// Pure logic for the monthly red-team scoreboard; scripts/redteam-history.ts wraps it for I/O.
// Same index shape and error rule as eval-history.

type PluginTotals = { passed: number; total: number };

export type RedteamSummaryEntry = {
  date: string;
  commitSha: string;
  /** 0-100 percentage rounded to 1 decimal (shields.io badge). */
  passRate: number;
  totalCases: number;
  passedCases: number;
  /** Cases the target never answered; excluded from `totalCases`/`passRate`, omitted when zero. */
  erroredCases?: number;
  byPlugin: Record<string, PluginTotals>;
};

export type RedteamHistoryIndex = {
  latest: RedteamSummaryEntry | null;
  runs: RedteamSummaryEntry[];
};

/** Minimal subset of promptfoo's `eval -o results.json` output that this module reads. */
export type PromptfooResultsFile = {
  results: {
    results: {
      success: boolean;
      error?: string;
      // promptfoo's ResultFailureReason: 0 none, 1 assertion, 2 error
      failureReason?: number;
      metadata?: { pluginId?: string };
      testCase?: { metadata?: { pluginId?: string } };
    }[];
  };
};

const FAILURE_REASON_ERROR = 2;
const UNKNOWN_PLUGIN = 'unknown';

export function createEmptyRedteamIndex(): RedteamHistoryIndex {
  return { latest: null, runs: [] };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function summarizeRedteamResults(
  report: PromptfooResultsFile,
  meta: { date: string; commitSha: string },
): RedteamSummaryEntry {
  const byPlugin: Record<string, PluginTotals> = {};
  let erroredCases = 0;
  let passedCases = 0;
  let totalCases = 0;

  for (const result of report.results.results) {
    if (result.failureReason === FAILURE_REASON_ERROR || result.error) {
      erroredCases++;
      continue;
    }
    const pluginId =
      result.metadata?.pluginId ??
      result.testCase?.metadata?.pluginId ??
      UNKNOWN_PLUGIN;
    const totals = (byPlugin[pluginId] ??= { passed: 0, total: 0 });
    totals.total++;
    totalCases++;
    if (result.success) {
      totals.passed++;
      passedCases++;
    }
  }

  return {
    date: meta.date,
    commitSha: meta.commitSha,
    passRate: totalCases === 0 ? 0 : round1((passedCases / totalCases) * 100),
    totalCases,
    passedCases,
    ...(erroredCases > 0 ? { erroredCases } : {}),
    byPlugin,
  };
}

/** Appends a new summary entry and refreshes `latest` to mirror it. */
export function appendRedteamSummary(
  index: RedteamHistoryIndex,
  entry: RedteamSummaryEntry,
): RedteamHistoryIndex {
  return { latest: entry, runs: [...index.runs, entry] };
}
