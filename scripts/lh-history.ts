// Thin CLI wrapper around src/lib/lighthouse-history.ts's pure transform
// logic. Reads the `lhci autorun --config=lighthouserc.live.json` output
// (manifest.json + per-run JSON reports, same shape scripts/lh-summary.mjs
// prints) and appends a summary entry to data/lighthouse-history/index.json,
// alongside data/eval-history's commit-back pattern.
//
// Usage: npx tsx scripts/lh-history.ts [--dir .lighthouseci-live]
//   - Date defaults to today (UTC, YYYY-MM-DD); override with $LH_DATE.
//   - Commit SHA defaults to $GITHUB_SHA, then `git rev-parse HEAD`, then
//     the literal string "unknown".
import fs from 'node:fs';
import path from 'node:path';
import {
  appendLighthouseSummary,
  createEmptyLighthouseIndex,
  summarizeLighthouseReports,
  type LighthouseHistoryIndex,
  type LighthouseManifestRun,
  type LighthouseReport,
} from '../src/lib/lighthouse-history';
import {
  readJsonWithFallback,
  resolveCommitSha,
  resolveDate,
  writeJson,
} from './lib/run-metadata';

const HISTORY_DIR = path.join('data', 'lighthouse-history');
const INDEX_PATH = path.join(HISTORY_DIR, 'index.json');

function resolveOutputDir(): string {
  const dirFlagIndex = process.argv.indexOf('--dir');
  return dirFlagIndex !== -1 && process.argv[dirFlagIndex + 1]
    ? process.argv[dirFlagIndex + 1]!
    : '.lighthouseci-live';
}

function readIndex(): LighthouseHistoryIndex {
  return readJsonWithFallback(INDEX_PATH, createEmptyLighthouseIndex);
}

function readRepresentativeReports(outputDir: string): LighthouseReport[] {
  const manifestPath = path.join(outputDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(
      `[lh-history] no manifest.json found at ${manifestPath} — did lhci autorun complete?`,
    );
    return [];
  }

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8'),
  ) as LighthouseManifestRun[];

  const reports: LighthouseReport[] = [];
  for (const run of manifest) {
    if (!run.isRepresentativeRun) continue;
    const jsonPath = path.join(outputDir, path.basename(run.jsonPath));
    if (!fs.existsSync(jsonPath)) continue;
    reports.push(
      JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as LighthouseReport,
    );
  }
  return reports;
}

function main(): void {
  const outputDir = resolveOutputDir();
  const reports = readRepresentativeReports(outputDir);

  if (reports.length === 0) {
    console.log(
      '[lh-history] no representative reports found — nothing to record.',
    );
    return;
  }

  const entry = summarizeLighthouseReports(reports, {
    date: resolveDate('LH_DATE'),
    commitSha: resolveCommitSha(),
  });
  const nextIndex = appendLighthouseSummary(readIndex(), entry);
  writeJson(INDEX_PATH, nextIndex);

  console.log(
    `[lh-history] recorded ${entry.urlCount} representative run(s): performance=${entry.scores.performance} accessibility=${entry.scores.accessibility} bestPractices=${entry.scores.bestPractices} seo=${entry.scores.seo}`,
  );
  console.log(`[lh-history] updated ${INDEX_PATH}`);
}

main();
