import { afterEach, beforeEach, expect, test } from 'vitest';
import { clearHistory, getHistory, pushHistory } from './history';

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

test('getHistory starts empty', () => {
  expect(getHistory()).toEqual([]);
});

test('pushHistory appends and persists an entry', () => {
  pushHistory('ls projects');
  expect(getHistory()).toEqual(['ls projects']);
});

test('pushHistory preserves order across multiple pushes', () => {
  pushHistory('ls');
  pushHistory('cd projects');
  pushHistory('pwd');
  expect(getHistory()).toEqual(['ls', 'cd projects', 'pwd']);
});

test('pushHistory ignores blank/whitespace-only entries', () => {
  pushHistory('   ');
  expect(getHistory()).toEqual([]);
});

test('pushHistory drops an immediate duplicate of the last entry', () => {
  pushHistory('ls');
  pushHistory('ls');
  expect(getHistory()).toEqual(['ls']);
});

test('pushHistory caps stored length so it does not grow unbounded', () => {
  for (let i = 0; i < 250; i++) pushHistory(`cmd-${i}`);
  const history = getHistory();
  expect(history.length).toBeLessThanOrEqual(200);
  // Most recent entry survives the cap.
  expect(history[history.length - 1]).toBe('cmd-249');
});

test('a fresh read reflects what a previous "session" persisted (survives reload)', () => {
  pushHistory('resume');
  // Simulate a reload by reading fresh — getHistory has no in-memory cache.
  expect(getHistory()).toContain('resume');
});

test('clearHistory empties persisted history', () => {
  pushHistory('ls');
  clearHistory();
  expect(getHistory()).toEqual([]);
});
