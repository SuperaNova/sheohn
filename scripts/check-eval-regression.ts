// Thin CLI wrapper around src/lib/eval-history.ts's checkEvalHealth.
//
// Reads the latest one or two entries of data/eval-history/index.json,
// loads their corresponding per-date detail files
// (data/eval-history/<date>.json), and reports pass→fail regressions
// (versus the previous run, when there is one) plus an absolute pass-rate
// floor breach (independent of any previous run — this is what catches a
// first-ever run scoring 0/10, which has no prior run to regress from).
//
// Usage: npx tsx scripts/check-eval-regression.ts
//   - EVAL_MIN_PASS_RATE overrides the floor (default 70).
//   - Exits 0 always (this is a report, not a gate) but writes
//     `has_regression` / `regressed_count` to $GITHUB_OUTPUT when running in
//     GitHub Actions, so a workflow step can branch on the result. A floor
//     breach alone also sets has_regression=true.
//   - Prints a markdown-formatted body to stdout when flagged —
//     .github/workflows/eval.yml redirects this to a file and passes it to
//     `gh issue create --body-file` / `gh issue comment --body-file`, so
//     this script never needs to touch the repo's git state itself.
import fs from 'node:fs';
import path from 'node:path';
import {
  checkEvalHealth,
  type EvalHistoryIndex,
  type EvalRunDetail,
} from '../src/lib/eval-history';
import { readJson, writeGithubOutput } from './lib/run-metadata';

const HISTORY_DIR =
  process.env.EVAL_HISTORY_DIR ?? path.join('data', 'eval-history');
const INDEX_PATH = path.join(HISTORY_DIR, 'index.json');
const DEFAULT_MIN_PASS_RATE = 70;

function resolveFloor(): number {
  const raw = process.env.EVAL_MIN_PASS_RATE;
  if (!raw) return DEFAULT_MIN_PASS_RATE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_MIN_PASS_RATE;
}

function formatRegressionBody(
  regressed: string[],
  current: EvalRunDetail,
  previous: EvalRunDetail,
): string {
  const casesByName = new Map(current.cases.map((c) => [c.name, c]));
  const lines = [
    `**${regressed.length} eval case(s) regressed** between \`${previous.date}\` (${previous.commitSha}) and \`${current.date}\` (${current.commitSha}).`,
    '',
  ];
  for (const name of regressed) {
    const c = casesByName.get(name);
    lines.push(`### ${name}`);
    lines.push(`- status: \`${c?.status ?? 'unknown'}\``);
    if (c?.error) {
      lines.push('```');
      lines.push(c.error);
      lines.push('```');
    }
    lines.push('');
  }
  return lines.join('\n');
}

function formatFloorBreachBody(
  current: EvalRunDetail,
  passRate: number,
  floor: number,
): string {
  return [
    `**Pass rate floor breached**: \`${current.date}\` (${current.commitSha}) scored ${passRate}% overall, below the ${floor}% floor.`,
    '',
  ].join('\n');
}

function main(): void {
  const floor = resolveFloor();

  if (!fs.existsSync(INDEX_PATH)) {
    console.log(
      '[check-eval-regression] no index.json found yet — nothing to compare.',
    );
    writeGithubOutput({ has_regression: 'false', regressed_count: '0' });
    return;
  }

  const index = readJson<EvalHistoryIndex>(INDEX_PATH);
  if (index.runs.length === 0) {
    console.log('[check-eval-regression] no runs recorded yet.');
    writeGithubOutput({ has_regression: 'false', regressed_count: '0' });
    return;
  }

  const currentEntry = index.runs[index.runs.length - 1]!;
  const currentDetailPath = path.join(HISTORY_DIR, `${currentEntry.date}.json`);
  if (!fs.existsSync(currentDetailPath)) {
    console.error(
      `[check-eval-regression] missing current detail file: ${currentDetailPath}`,
    );
    writeGithubOutput({ has_regression: 'false', regressed_count: '0' });
    return;
  }
  const current = readJson<EvalRunDetail>(currentDetailPath);

  let previous: EvalRunDetail | null = null;
  if (index.runs.length < 2) {
    console.log(
      '[check-eval-regression] fewer than 2 runs in history — skipping regression comparison, floor check still applies.',
    );
  } else {
    const previousEntry = index.runs[index.runs.length - 2]!;
    const previousDetailPath = path.join(
      HISTORY_DIR,
      `${previousEntry.date}.json`,
    );
    if (fs.existsSync(previousDetailPath)) {
      previous = readJson<EvalRunDetail>(previousDetailPath);
    } else {
      console.error(
        `[check-eval-regression] missing previous detail file: ${previousDetailPath} — skipping regression comparison, floor check still applies.`,
      );
    }
  }

  const health = checkEvalHealth(current, previous, floor);

  if (!health.flagged) {
    console.log(
      `[check-eval-regression] no regressions, pass rate ${health.passRate}% at/above the ${floor}% floor.`,
    );
    writeGithubOutput({ has_regression: 'false', regressed_count: '0' });
    return;
  }

  const bodyParts: string[] = [];
  if (health.regressedCases.length > 0) {
    console.log(
      `[check-eval-regression] ${health.regressedCases.length} regression(s): ${health.regressedCases.join(', ')}`,
    );
    bodyParts.push(
      formatRegressionBody(health.regressedCases, current, previous!),
    );
  }
  if (health.floorBreached) {
    console.log(
      `[check-eval-regression] pass rate floor breached: ${health.passRate}% < ${floor}%`,
    );
    bodyParts.push(formatFloorBreachBody(current, health.passRate, floor));
  }
  console.log('');
  console.log(bodyParts.join('\n'));

  writeGithubOutput({
    has_regression: 'true',
    regressed_count: String(health.regressedCases.length),
  });
}

main();
