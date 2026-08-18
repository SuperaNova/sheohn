import { describe, expect, test } from 'vitest';
import {
  appendMutationSummary,
  buildMutationSummaryEntry,
  calculateMutationScore,
  countMutants,
  createEmptyMutationIndex,
  type StrykerMutationReport,
} from './mutation-summary';

const fixtureReport: StrykerMutationReport = {
  files: {
    'src/lib/prompts.ts': {
      mutants: [
        { status: 'Killed' },
        { status: 'Killed' },
        { status: 'Survived' },
        { status: 'Timeout' },
        { status: 'NoCoverage' },
        { status: 'Ignored' },
      ],
    },
    'src/lib/motion.ts': {
      mutants: [{ status: 'Killed' }, { status: 'CompileError' }],
    },
  },
};

describe('countMutants', () => {
  test('tallies mutants by status across every file', () => {
    expect(countMutants(fixtureReport)).toEqual({
      killed: 3,
      survived: 1,
      timeout: 1,
      noCoverage: 1,
      totalMutants: 8,
    });
  });

  test('returns all-zero counts for an empty report', () => {
    expect(countMutants({ files: {} })).toEqual({
      killed: 0,
      survived: 0,
      timeout: 0,
      noCoverage: 0,
      totalMutants: 0,
    });
  });
});

describe('calculateMutationScore', () => {
  test('is detected / valid * 100, excluding invalid/ignored mutants', () => {
    // detected = killed(3) + timeout(1) = 4; valid = detected + survived(1) + noCoverage(1) = 6
    const score = calculateMutationScore(countMutants(fixtureReport));
    expect(score).toBeCloseTo(66.7, 1);
  });

  test('returns 0 instead of NaN when there are no valid mutants', () => {
    expect(
      calculateMutationScore({
        killed: 0,
        survived: 0,
        timeout: 0,
        noCoverage: 0,
        totalMutants: 0,
      }),
    ).toBe(0);
  });
});

describe('buildMutationSummaryEntry / appendMutationSummary / createEmptyMutationIndex', () => {
  test('createEmptyMutationIndex seeds latest: null, runs: []', () => {
    expect(createEmptyMutationIndex()).toEqual({ latest: null, runs: [] });
  });

  test('buildMutationSummaryEntry attaches metadata and the computed score', () => {
    const entry = buildMutationSummaryEntry(fixtureReport, {
      date: '2026-07-20',
      commitSha: 'abc123',
    });

    expect(entry).toEqual({
      date: '2026-07-20',
      commitSha: 'abc123',
      mutationScore: 66.7,
      killed: 3,
      survived: 1,
      timeout: 1,
      noCoverage: 1,
      totalMutants: 8,
    });
  });

  test('appendMutationSummary appends to runs and mirrors the entry in latest', () => {
    const entry = buildMutationSummaryEntry(fixtureReport, {
      date: '2026-07-20',
      commitSha: 'abc123',
    });
    const index = appendMutationSummary(createEmptyMutationIndex(), entry);

    expect(index.runs).toEqual([entry]);
    expect(index.latest).toEqual(entry);

    const secondEntry = buildMutationSummaryEntry(fixtureReport, {
      date: '2026-07-27',
      commitSha: 'def456',
    });
    const secondIndex = appendMutationSummary(index, secondEntry);
    expect(secondIndex.runs).toEqual([entry, secondEntry]);
    expect(secondIndex.latest).toEqual(secondEntry);
  });
});
