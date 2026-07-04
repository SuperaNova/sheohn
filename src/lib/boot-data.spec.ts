import { expect, test } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import { getBootInfo } from './boot-data';

const manifest = pkg as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const handComputedDepCount =
  Object.keys(manifest.dependencies ?? {}).length +
  Object.keys(manifest.devDependencies ?? {}).length;

test('dependencyCount matches a hand-computed count from package.json', () => {
  const info = getBootInfo();
  expect(info.dependencyCount).toBe(handComputedDepCount);
  expect(info.dependencyCount).toBeGreaterThan(0);
});

test('never throws when VERCEL_GIT_COMMIT_SHA is unset, falling back to git/dev', () => {
  expect(() => getBootInfo({ vercelGitCommitSha: undefined })).not.toThrow();
  const info = getBootInfo({ vercelGitCommitSha: undefined });
  expect(typeof info.commitSha).toBe('string');
  expect(info.commitSha.length).toBeGreaterThan(0);
});

test('prefers the injected Vercel commit SHA over exec', () => {
  const info = getBootInfo({
    vercelGitCommitSha: 'abc1234',
    exec: () => {
      throw new Error('should not be called');
    },
  });
  expect(info.commitSha).toBe('abc1234');
});

test('falls back to an injected exec() when no Vercel SHA is present', () => {
  const info = getBootInfo({
    vercelGitCommitSha: undefined,
    exec: () => 'def5678\n',
  });
  expect(info.commitSha).toBe('def5678');
});

test('falls back to "dev" when exec throws (no git binary / no HEAD)', () => {
  const info = getBootInfo({
    vercelGitCommitSha: undefined,
    exec: () => {
      throw new Error('git not found');
    },
  });
  expect(info.commitSha).toBe('dev');
});

test('falls back to "dev" when exec returns an empty string', () => {
  const info = getBootInfo({
    vercelGitCommitSha: undefined,
    exec: () => '   ',
  });
  expect(info.commitSha).toBe('dev');
});

test('buildTimestamp is a valid ISO timestamp', () => {
  const info = getBootInfo();
  expect(new Date(info.buildTimestamp).toISOString()).toBe(info.buildTimestamp);
});

test('vectorCount is omitted for v1', () => {
  const info = getBootInfo();
  expect(info.vectorCount).toBeUndefined();
});
