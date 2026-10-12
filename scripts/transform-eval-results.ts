// Transforms a Playwright JSON report (`npm run eval:agent -- --reporter=json`) via src/lib/eval-history.ts:
//   - data/eval-history/<ISO-date>.json: full per-case detail for this run
//   - data/eval-history/index.json: appends a summary entry and refreshes a top-level `latest`
//     field (shields.io's dynamic-JSON badge needs a stable JSONPath).
// Usage: npx tsx scripts/transform-eval-results.ts [path-to-report.json]
//   - Report path defaults to $PLAYWRIGHT_JSON_OUTPUT_NAME, then
//     ./playwright-report/results.json.
//   - Date defaults to today (UTC, YYYY-MM-DD); override with $EVAL_DATE
//     (used by tests/local dry-runs so output is deterministic).
//   - Commit SHA defaults to $GITHUB_SHA (set by GitHub Actions), then
//     `git rev-parse HEAD`, then the literal string "unknown".
import fs from 'node:fs';
import path from 'node:path';
import {
  appendSummary,
  buildEvalRunDetail,
  createEmptyIndex,
  summarizeRun,
  type EvalHistoryIndex,
  type PlaywrightJsonReport,
} from '../src/lib/eval-history';
import {
  readJsonWithFallback,
  resolveCommitSha,
  resolveDate,
  writeJson,
} from './lib/run-metadata';

const HISTORY_DIR =
  process.env.EVAL_HISTORY_DIR ?? path.join('data', 'eval-history');
const INDEX_PATH = path.join(HISTORY_DIR, 'index.json');

function resolveReportPath(): string {
  const argPath = process.argv[2];
  return (
    argPath ??
    process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ??
    path.join('playwright-report', 'results.json')
  );
}

function readIndex(): EvalHistoryIndex {
  return readJsonWithFallback(INDEX_PATH, createEmptyIndex);
}

function main(): void {
  const reportPath = resolveReportPath();
  if (!fs.existsSync(reportPath)) {
    console.error(`[transform-eval-results] No report found at ${reportPath}`);
    process.exit(1);
  }

  const report = JSON.parse(
    fs.readFileSync(reportPath, 'utf8'),
  ) as PlaywrightJsonReport;
  const date = resolveDate('EVAL_DATE');
  const commitSha = resolveCommitSha();

  const detail = buildEvalRunDetail(report, { date, commitSha });
  const detailPath = path.join(HISTORY_DIR, `${date}.json`);
  writeJson(detailPath, detail);

  const summary = summarizeRun(detail);
  const nextIndex = appendSummary(readIndex(), summary);
  writeJson(INDEX_PATH, nextIndex);

  console.log(
    `[transform-eval-results] ${detail.cases.length} cases, ${summary.passedCases}/${summary.totalCases} passed (${summary.passRate}%)`,
  );
  console.log(`[transform-eval-results] wrote ${detailPath}`);
  console.log(`[transform-eval-results] updated ${INDEX_PATH}`);
}

main();
