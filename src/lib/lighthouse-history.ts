// Pure logic for the Lighthouse score history committed alongside eval
// history; scripts/lh-history.ts wraps it for I/O (reading
// .lighthouseci-live/manifest.json + per-run reports, writing
// data/lighthouse-history/index.json).

/** Scores are 0-100, averaged across every representative run in a batch. */
interface LighthouseCategoryScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface LighthouseSummaryEntry {
  date: string;
  commitSha: string;
  scores: LighthouseCategoryScores;
  /** How many representative runs (URLs) contributed to the average. */
  urlCount: number;
}

/** `latest` mirrors the newest entry of `runs` — same shape as eval-history's index. */
export interface LighthouseHistoryIndex {
  latest: LighthouseSummaryEntry | null;
  runs: LighthouseSummaryEntry[];
}

export function createEmptyLighthouseIndex(): LighthouseHistoryIndex {
  return { latest: null, runs: [] };
}

/** Minimal subset of an lhci manifest entry this module reads. */
export interface LighthouseManifestRun {
  isRepresentativeRun?: boolean;
  jsonPath: string;
}

/** Minimal subset of a Lighthouse JSON report this module reads (0-1 scale). */
export interface LighthouseReport {
  categories: {
    performance?: { score: number | null };
    accessibility?: { score: number | null };
    'best-practices'?: { score: number | null };
    seo?: { score: number | null };
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function averagePercent(scores: (number | null | undefined)[]): number {
  const values = scores.map((s) => (s ?? 0) * 100);
  if (values.length === 0) return 0;
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Builds one summary entry by averaging every representative run's category scores. */
export function summarizeLighthouseReports(
  reports: LighthouseReport[],
  meta: { date: string; commitSha: string },
): LighthouseSummaryEntry {
  return {
    date: meta.date,
    commitSha: meta.commitSha,
    scores: {
      performance: averagePercent(
        reports.map((r) => r.categories.performance?.score),
      ),
      accessibility: averagePercent(
        reports.map((r) => r.categories.accessibility?.score),
      ),
      bestPractices: averagePercent(
        reports.map((r) => r.categories['best-practices']?.score),
      ),
      seo: averagePercent(reports.map((r) => r.categories.seo?.score)),
    },
    urlCount: reports.length,
  };
}

/** Appends a new summary entry and refreshes `latest` to mirror it. */
export function appendLighthouseSummary(
  index: LighthouseHistoryIndex,
  entry: LighthouseSummaryEntry,
): LighthouseHistoryIndex {
  return {
    latest: entry,
    runs: [...index.runs, entry],
  };
}
