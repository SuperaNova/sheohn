import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { getColophonData } from './colophon-data';

const manifest = pkg as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const handComputedDepCount =
  Object.keys(manifest.dependencies ?? {}).length +
  Object.keys(manifest.devDependencies ?? {}).length;

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

test('dependencyCount matches a hand-computed count from package.json', () => {
  const data = getColophonData();
  expect(data.dependencyCount).toBe(handComputedDepCount);
  expect(data.dependencyCount).toBeGreaterThan(0);
});

test('loc is a plausible non-zero count of source lines', () => {
  const data = getColophonData();
  expect(Number.isInteger(data.loc)).toBe(true);
  expect(data.loc).toBeGreaterThan(0);
});

test('commitSha and buildTimestamp are populated', () => {
  const data = getColophonData();
  expect(typeof data.commitSha).toBe('string');
  expect(data.commitSha.length).toBeGreaterThan(0);
  expect(new Date(data.buildTimestamp).toISOString()).toBe(data.buildTimestamp);
});

describe('graceful degradation when optional files are absent', () => {
  test('coveragePercent is undefined when coverage-summary.json does not exist', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'colophon-test-'));
    const missingPath = join(tempDir, 'coverage-summary.json');

    const data = getColophonData({ coverageSummaryPath: missingPath });

    expect(data.coveragePercent).toBeUndefined();
  });

  test('evalPassRate is undefined when eval-history index.json does not exist', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'colophon-test-'));
    const missingPath = join(tempDir, 'index.json');

    const data = getColophonData({ evalHistoryIndexPath: missingPath });

    expect(data.evalPassRate).toBeUndefined();
  });

  test('coveragePercent is undefined when the file contains malformed JSON', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'colophon-test-'));
    const badPath = join(tempDir, 'coverage-summary.json');
    writeFileSync(badPath, '{not valid json');

    const data = getColophonData({ coverageSummaryPath: badPath });

    expect(data.coveragePercent).toBeUndefined();
  });

  test('evalPassRate is undefined when the file contains malformed JSON', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'colophon-test-'));
    const badPath = join(tempDir, 'index.json');
    writeFileSync(badPath, '{not valid json');

    const data = getColophonData({ evalHistoryIndexPath: badPath });

    expect(data.evalPassRate).toBeUndefined();
  });
});

describe('reads real values when files are present', () => {
  test('coveragePercent reflects total.lines.pct from a fixture file', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'colophon-test-'));
    const fixturePath = join(tempDir, 'coverage-summary.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({ total: { lines: { pct: 87.5 } } }),
    );

    const data = getColophonData({ coverageSummaryPath: fixturePath });

    expect(data.coveragePercent).toBe(87.5);
  });

  test('evalPassRate reflects the latest entry pass rate from a fixture file', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'colophon-test-'));
    const fixturePath = join(tempDir, 'index.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({
        latest: {
          date: '2026-07-06',
          commitSha: 'abc123',
          passRate: 92.3,
          totalCases: 10,
          passedCases: 9,
        },
        runs: [],
      }),
    );

    const data = getColophonData({ evalHistoryIndexPath: fixturePath });

    expect(data.evalPassRate).toBe(92.3);
  });

  test('evalPassRate is undefined when latest is null (seed file shape)', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'colophon-test-'));
    const fixturePath = join(tempDir, 'index.json');
    writeFileSync(fixturePath, JSON.stringify({ latest: null, runs: [] }));

    const data = getColophonData({ evalHistoryIndexPath: fixturePath });

    expect(data.evalPassRate).toBeUndefined();
  });
});
