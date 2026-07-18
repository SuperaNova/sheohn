import { describe, expect, test } from 'vitest';
import {
  appendLighthouseSummary,
  createEmptyLighthouseIndex,
  summarizeLighthouseReports,
  type LighthouseReport,
} from './lighthouse-history';

describe('createEmptyLighthouseIndex', () => {
  test('seeds latest: null, runs: []', () => {
    expect(createEmptyLighthouseIndex()).toEqual({ latest: null, runs: [] });
  });
});

describe('summarizeLighthouseReports', () => {
  test('averages category scores across representative runs, scaled to 0-100', () => {
    const reports: LighthouseReport[] = [
      {
        categories: {
          performance: { score: 0.9 },
          accessibility: { score: 1 },
          'best-practices': { score: 0.92 },
          seo: { score: 1 },
        },
      },
      {
        categories: {
          performance: { score: 0.8 },
          accessibility: { score: 0.9 },
          'best-practices': { score: 0.92 },
          seo: { score: 0.9 },
        },
      },
    ];

    const entry = summarizeLighthouseReports(reports, {
      date: '2026-07-13',
      commitSha: 'abc123',
    });

    expect(entry).toEqual({
      date: '2026-07-13',
      commitSha: 'abc123',
      scores: {
        performance: 85,
        accessibility: 95,
        bestPractices: 92,
        seo: 95,
      },
      urlCount: 2,
    });
  });

  test('treats a null score as 0 rather than throwing', () => {
    const reports: LighthouseReport[] = [
      {
        categories: {
          performance: { score: null },
        },
      },
    ];
    const entry = summarizeLighthouseReports(reports, {
      date: '2026-07-13',
      commitSha: 'abc123',
    });
    expect(entry.scores.performance).toBe(0);
  });

  test('handles an empty report list without dividing by zero', () => {
    const entry = summarizeLighthouseReports([], {
      date: '2026-07-13',
      commitSha: 'abc123',
    });
    expect(entry.scores).toEqual({
      performance: 0,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
    });
    expect(entry.urlCount).toBe(0);
  });
});

describe('appendLighthouseSummary', () => {
  test('appends to runs and mirrors the entry in latest', () => {
    const entry = summarizeLighthouseReports(
      [{ categories: { performance: { score: 1 } } }],
      { date: '2026-07-13', commitSha: 'abc123' },
    );
    const index = appendLighthouseSummary(createEmptyLighthouseIndex(), entry);

    expect(index.runs).toEqual([entry]);
    expect(index.latest).toEqual(entry);
  });
});
