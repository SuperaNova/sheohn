// CLI wrapper over src/lib/mutation-summary.ts: reads Stryker's JSON report and appends a summary
// entry to data/mutation-score.json.
// Usage: npx tsx scripts/mutation-summary.ts [path-to-mutation.json]
//   - Report path defaults to reports/mutation/mutation.json.
//   - Date defaults to today (UTC); override with $MUTATION_DATE.
//   - Commit SHA defaults to $GITHUB_SHA, then `git rev-parse HEAD`, then "unknown".
import fs from 'node:fs';
import path from 'node:path';
import {
  appendMutationSummary,
  buildMutationSummaryEntry,
  createEmptyMutationIndex,
  type MutationScoreIndex,
  type StrykerMutationReport,
} from '../src/lib/mutation-summary';
import {
  readJsonWithFallback,
  resolveCommitSha,
  resolveDate,
  writeJson,
} from './lib/run-metadata';

const INDEX_PATH = path.join('data', 'mutation-score.json');

function resolveReportPath(): string {
  return process.argv[2] ?? path.join('reports', 'mutation', 'mutation.json');
}

function readIndex(): MutationScoreIndex {
  return readJsonWithFallback(INDEX_PATH, createEmptyMutationIndex);
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
    date: resolveDate('MUTATION_DATE'),
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
