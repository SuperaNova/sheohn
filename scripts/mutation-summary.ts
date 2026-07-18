// Thin CLI wrapper around src/lib/mutation-summary.ts's pure transform
// logic. Reads Stryker's JSON reporter output (reports/mutation/mutation.json
// by default, see stryker.config.json's jsonReporter) and appends a summary
// entry to data/mutation-score.json, alongside data/eval-history's
// commit-back pattern.
//
// Usage: npx tsx scripts/mutation-summary.ts [path-to-mutation.json]
//   - Report path defaults to reports/mutation/mutation.json.
//   - Date defaults to today (UTC, YYYY-MM-DD); override with $MUTATION_DATE.
//   - Commit SHA defaults to $GITHUB_SHA, then `git rev-parse HEAD`, then
//     the literal string "unknown".
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  appendMutationSummary,
  buildMutationSummaryEntry,
  createEmptyMutationIndex,
  type MutationScoreIndex,
  type StrykerMutationReport,
} from '../src/lib/mutation-summary';

const INDEX_PATH = path.join('data', 'mutation-score.json');

function resolveReportPath(): string {
  return process.argv[2] ?? path.join('reports', 'mutation', 'mutation.json');
}

function resolveDate(): string {
  return process.env.MUTATION_DATE ?? new Date().toISOString().slice(0, 10);
}

function resolveCommitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function readIndex(): MutationScoreIndex {
  if (!fs.existsSync(INDEX_PATH)) return createEmptyMutationIndex();
  try {
    return JSON.parse(
      fs.readFileSync(INDEX_PATH, 'utf8'),
    ) as MutationScoreIndex;
  } catch {
    return createEmptyMutationIndex();
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function main(): void {
  const reportPath = resolveReportPath();
  if (!fs.existsSync(reportPath)) {
    console.error(`[mutation-summary] No report found at ${reportPath}`);
    process.exit(1);
  }

  const report = JSON.parse(
    fs.readFileSync(reportPath, 'utf8'),
  ) as StrykerMutationReport;

  const entry = buildMutationSummaryEntry(report, {
    date: resolveDate(),
    commitSha: resolveCommitSha(),
  });
  const nextIndex = appendMutationSummary(readIndex(), entry);
  writeJson(INDEX_PATH, nextIndex);

  console.log(
    `[mutation-summary] score=${entry.mutationScore}% killed=${entry.killed} survived=${entry.survived} timeout=${entry.timeout} noCoverage=${entry.noCoverage} total=${entry.totalMutants}`,
  );
  console.log(`[mutation-summary] updated ${INDEX_PATH}`);
}

main();
