// CLI wrapper over src/lib/redteam-history.ts: reads promptfoo's results JSON and appends a
// summary entry to data/redteam-history/index.json.
// Usage: npx tsx scripts/redteam-history.ts [path-to-results.json]
//   - Report path defaults to reports/redteam/results.json.
//   - Date defaults to today (UTC); override with $REDTEAM_DATE.
//   - Commit SHA defaults to $GITHUB_SHA, then `git rev-parse HEAD`, then "unknown".
import fs from 'node:fs';
import path from 'node:path';
import {
  appendRedteamSummary,
  createEmptyRedteamIndex,
  summarizeRedteamResults,
  type PromptfooResultsFile,
  type RedteamHistoryIndex,
} from '../src/lib/redteam-history';
import {
  readJson,
  readJsonWithFallback,
  resolveCommitSha,
  resolveDate,
  writeJson,
} from './lib/run-metadata';

const INDEX_PATH = path.join('data', 'redteam-history', 'index.json');

function resolveReportPath(): string {
  return process.argv[2] ?? path.join('reports', 'redteam', 'results.json');
}

function readIndex(): RedteamHistoryIndex {
  return readJsonWithFallback(INDEX_PATH, createEmptyRedteamIndex);
}

function main(): void {
  const reportPath = resolveReportPath();
  if (!fs.existsSync(reportPath)) {
    console.error(`[redteam-history] No report found at ${reportPath}`);
    process.exit(1);
  }

  const entry = summarizeRedteamResults(
    readJson<PromptfooResultsFile>(reportPath),
    { date: resolveDate('REDTEAM_DATE'), commitSha: resolveCommitSha() },
  );
  writeJson(INDEX_PATH, appendRedteamSummary(readIndex(), entry));

  console.log(
    `[redteam-history] passRate=${entry.passRate}% passed=${entry.passedCases} total=${entry.totalCases} errored=${entry.erroredCases ?? 0}`,
  );
  console.log(`[redteam-history] updated ${INDEX_PATH}`);
}

main();
