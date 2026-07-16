import { expect, test } from 'vitest';
import type { BootInfo } from './boot-info';
import {
  buildDeckBootLines,
  buildLoaderLines,
  formatDmesgTimestamp,
} from './dmesg';

const TS_RE = /^\[ {0,3}\d+\.\d{6}\]$/;

const bootInfo: BootInfo = {
  commitSha: 'abc1234',
  buildTimestamp: '2026-07-16T00:00:00.000Z',
  dependencyCount: 42,
};

test('formatDmesgTimestamp is format-exact for narrow and wide seconds', () => {
  expect(formatDmesgTimestamp(0.001379)).toMatch(TS_RE);
  expect(formatDmesgTimestamp(2.214053)).toMatch(TS_RE);
  expect(formatDmesgTimestamp(1402.1)).toMatch(TS_RE);
});

test('loader lines have strictly monotonic, format-exact timestamps', () => {
  const lines = buildLoaderLines(bootInfo);
  expect(lines.length).toBeGreaterThan(0);
  let prev = -Infinity;
  for (const line of lines) {
    expect(line.ts).toMatch(TS_RE);
    const seconds = Number(line.ts.slice(1, -1).trim());
    expect(seconds).toBeGreaterThan(prev);
    prev = seconds;
  }
});

test('deck boot lines have strictly monotonic, format-exact timestamps', () => {
  const lines = buildDeckBootLines(bootInfo);
  let prev = -Infinity;
  for (const line of lines) {
    expect(line.ts).toMatch(TS_RE);
    const seconds = Number(line.ts.slice(1, -1).trim());
    expect(seconds).toBeGreaterThan(prev);
    prev = seconds;
  }
});

test('loader lines surface the real commit SHA, build timestamp, and dependency count', () => {
  const text = buildLoaderLines(bootInfo)
    .map((l) => l.text)
    .join('\n');
  expect(text).toContain(bootInfo.commitSha);
  expect(text).toContain(bootInfo.buildTimestamp);
  expect(text).toContain(String(bootInfo.dependencyCount));
});

test('deck boot lines surface the real commit SHA, build timestamp, and dependency count', () => {
  const text = buildDeckBootLines(bootInfo)
    .map((l) => l.text)
    .join('\n');
  expect(text).toContain(bootInfo.commitSha);
  expect(text).toContain(bootInfo.buildTimestamp);
  expect(text).toContain(String(bootInfo.dependencyCount));
});

test('deck boot line count includes vectorCount only when present', () => {
  const withoutVector = buildDeckBootLines(bootInfo);
  const withVector = buildDeckBootLines({ ...bootInfo, vectorCount: 512 });
  expect(withVector.length).toBe(withoutVector.length + 1);
  expect(withVector.map((l) => l.text).join('\n')).toContain('512');
});

test('the deck sequence is shorter than the loader sequence, with or without vectorCount', () => {
  const loaderCount = buildLoaderLines(bootInfo).length;
  expect(buildDeckBootLines(bootInfo).length).toBeLessThan(loaderCount);
  expect(
    buildDeckBootLines({ ...bootInfo, vectorCount: 10 }).length,
  ).toBeLessThan(loaderCount);
});

test('both builders are deterministic — two calls deep-equal', () => {
  expect(buildLoaderLines(bootInfo)).toEqual(buildLoaderLines(bootInfo));
  expect(buildDeckBootLines(bootInfo)).toEqual(buildDeckBootLines(bootInfo));
});
