// Compares two eval runs (evaluateImprovement in src/lib/prompt-heal.ts) for heal-prompt.yml.
// Usage: npx tsx scripts/compare-eval-runs.ts <before.json> <after.json>
//   - Always exits 0; writes `improved`, `before_pass_rate`, `after_pass_rate`, `recovered_count`,
//     `recovered_cases` to $GITHUB_OUTPUT under GitHub Actions.
//   - Prints a markdown before/after body to stdout for the PR description.
import fs from 'node:fs';
import { evaluateImprovement } from '../src/lib/prompt-heal';
import type { EvalRunDetail } from '../src/lib/eval-history';

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeGithubOutput(entries: Record<string, string>): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return; // not running in a workflow (e.g. local dry-run)
  const lines = Object.entries(entries)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  fs.appendFileSync(outputPath, lines + '\n', 'utf8');
}

function main(): void {
  const [beforePath, afterPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) {
    console.error(
      'Usage: npx tsx scripts/compare-eval-runs.ts <before.json> <after.json>',
    );
    process.exit(1);
  }

  const before = readJson<EvalRunDetail>(beforePath);
  const after = readJson<EvalRunDetail>(afterPath);
  const result = evaluateImprovement(before, after);

  const body = [
    `**Before**: ${result.beforePassRate}% (\`${before.date}\`, ${before.commitSha})`,
    `**After**: ${result.afterPassRate}% (candidate branch)`,
    '',
    result.recoveredCases.length > 0
      ? `Recovered case(s): ${result.recoveredCases.join(', ')}`
      : 'No cases recovered.',
  ].join('\n');
  console.log(body);

  writeGithubOutput({
    improved: String(result.improved),
    before_pass_rate: String(result.beforePassRate),
    after_pass_rate: String(result.afterPassRate),
    recovered_count: String(result.recoveredCases.length),
    recovered_cases: result.recoveredCases.join(', '),
  });
}

main();
