// Shared helpers for the data/*-history CLI scripts (lh-history,
// mutation-summary, transform-eval-results, check-eval-regression):
// commit/date resolution, JSON read/write with a trailing newline, and
// $GITHUB_OUTPUT writes.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function resolveCommitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

// envVar names the script-specific override (e.g. "EVAL_DATE"); falls back
// to today (UTC, YYYY-MM-DD).
export function resolveDate(envVar: string): string {
  return process.env[envVar] ?? new Date().toISOString().slice(0, 10);
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function readJsonWithFallback<T>(
  filePath: string,
  fallback: () => T,
): T {
  if (!fs.existsSync(filePath)) return fallback();
  try {
    return readJson<T>(filePath);
  } catch {
    return fallback();
  }
}

export function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function writeGithubOutput(entries: Record<string, string>): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return; // not running in a workflow (e.g. local/manual invocation)
  const lines = Object.entries(entries)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  fs.appendFileSync(outputPath, lines + '\n', 'utf8');
}
