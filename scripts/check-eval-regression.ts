// Thin CLI wrapper around src/lib/eval-history.ts's findRegressedCases.
//
// Reads the last two entries of data/eval-history/index.json, loads their
// corresponding per-date detail files (data/eval-history/<date>.json), and
// reports which case names flipped from passing to not-passing.
//
// Usage: npx tsx scripts/check-eval-regression.ts
//   - Exits 0 always (this is a report, not a gate) but writes
//     `has_regression` / `regressed_count` to $GITHUB_OUTPUT when running in
//     GitHub Actions, so a workflow step can branch on the result.
//   - Prints a markdown-formatted regression body to stdout when a
//     regression is found — .github/workflows/eval.yml redirects this to a
//     file and passes it to `gh issue create --body-file` / `gh issue
//     comment --body-file`, so this script never needs to touch the repo's
//     git state itself.
import fs from 'node:fs';
import path from 'node:path';
import {
  findRegressedCases,
  type EvalHistoryIndex,
  type EvalRunDetail,
} from '../src/lib/eval-history';
import { readJson, writeGithubOutput } from './lib/run-metadata';

const HISTORY_DIR =
  process.env.EVAL_HISTORY_DIR ?? path.join('data', 'eval-history');
const INDEX_PATH = path.join(HISTORY_DIR, 'index.json');

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

function main(): void {
  if (!fs.existsSync(INDEX_PATH)) {
    console.log(
      '[check-eval-regression] no index.json found yet — nothing to compare.',
    );
    writeGithubOutput({ has_regression: 'false', regressed_count: '0' });
    return;
  }

  const index = readJson<EvalHistoryIndex>(INDEX_PATH);
  if (index.runs.length < 2) {
    console.log(
      '[check-eval-regression] fewer than 2 runs in history — nothing to compare yet.',
    );
    writeGithubOutput({ has_regression: 'false', regressed_count: '0' });
    return;
  }

  const previousEntry = index.runs[index.runs.length - 2]!;
  const currentEntry = index.runs[index.runs.length - 1]!;

  const previousDetailPath = path.join(
    HISTORY_DIR,
    `${previousEntry.date}.json`,
  );
  const currentDetailPath = path.join(HISTORY_DIR, `${currentEntry.date}.json`);

  if (!fs.existsSync(previousDetailPath) || !fs.existsSync(currentDetailPath)) {
    console.error(
      `[check-eval-regression] missing detail file(s): ${previousDetailPath} / ${currentDetailPath}`,
    );
    writeGithubOutput({ has_regression: 'false', regressed_count: '0' });
    return;
  }

  const previous = readJson<EvalRunDetail>(previousDetailPath);
  const current = readJson<EvalRunDetail>(currentDetailPath);

  const regressed = findRegressedCases(previous, current);

  if (regressed.length === 0) {
    console.log('[check-eval-regression] no regressions.');
    writeGithubOutput({ has_regression: 'false', regressed_count: '0' });
    return;
  }

  console.log(
    `[check-eval-regression] ${regressed.length} regression(s): ${regressed.join(', ')}`,
  );
  console.log('');
  console.log(formatRegressionBody(regressed, current, previous));

  writeGithubOutput({
    has_regression: 'true',
    regressed_count: String(regressed.length),
  });
}

main();
