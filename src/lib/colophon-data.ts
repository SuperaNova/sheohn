// Build-time-only module: pure filesystem inspection, no network — must stay
// safe under a stub-secret CI build. Call only from Astro frontmatter (same
// constraint as boot-data.ts).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getBootInfo } from './boot-data';
import type { EvalHistoryIndex } from './eval-history';

const DEFAULT_COVERAGE_SUMMARY_PATH = join(
  process.cwd(),
  'coverage/coverage-summary.json',
);
const DEFAULT_EVAL_HISTORY_INDEX_PATH = join(
  process.cwd(),
  'data/eval-history/index.json',
);

export interface ColophonData {
  dependencyCount: number;
  /** Non-blank line count across src/**\/*.{ts,svelte,astro} — source code only, no MDX content. */
  loc: number;
  commitSha: string;
  buildTimestamp: string;
  /** `total.lines.pct` from coverage/coverage-summary.json, undefined if the file is absent/unreadable. */
  coveragePercent?: number;
  /** Latest entry's passRate from data/eval-history/index.json, undefined if absent/unreadable/no runs yet. */
  evalPassRate?: number;
}

/** Injectable file paths so tests never touch the real coverage/eval-history files. */
export interface ColophonDataPaths {
  coverageSummaryPath?: string;
  evalHistoryIndexPath?: string;
}

// Eager + raw: runs once at build time and never ships to the client.
const sourceFiles = import.meta.glob('/src/**/*.{ts,svelte,astro}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function countLoc(files: Record<string, string>): number {
  let total = 0;
  for (const content of Object.values(files)) {
    for (const line of content.split('\n')) {
      if (line.trim().length > 0) total += 1;
    }
  }
  return total;
}

interface CoverageSummaryFile {
  total?: { lines?: { pct?: number } };
}

function readCoveragePercent(path: string): number | undefined {
  try {
    if (!existsSync(path)) return undefined;
    const parsed = JSON.parse(
      readFileSync(path, 'utf8'),
    ) as CoverageSummaryFile;
    const pct = parsed.total?.lines?.pct;
    return typeof pct === 'number' ? pct : undefined;
  } catch {
    return undefined;
  }
}

function readEvalPassRate(path: string): number | undefined {
  try {
    if (!existsSync(path)) return undefined;
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as EvalHistoryIndex;
    return parsed.latest?.passRate;
  } catch {
    return undefined;
  }
}

/**
 * Computes the colophon page's data. Every optional field degrades to
 * `undefined` (never throws) so the stub-secret CI build always succeeds
 * regardless of which local-only files exist.
 */
export function getColophonData(paths: ColophonDataPaths = {}): ColophonData {
  const bootInfo = getBootInfo();

  return {
    dependencyCount: bootInfo.dependencyCount,
    loc: countLoc(sourceFiles),
    commitSha: bootInfo.commitSha,
    buildTimestamp: bootInfo.buildTimestamp,
    coveragePercent: readCoveragePercent(
      paths.coverageSummaryPath ?? DEFAULT_COVERAGE_SUMMARY_PATH,
    ),
    evalPassRate: readEvalPassRate(
      paths.evalHistoryIndexPath ?? DEFAULT_EVAL_HISTORY_INDEX_PATH,
    ),
  };
}
