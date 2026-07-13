import { expect, test } from 'vitest';
import { complete } from './completion';
import { buildVfs, type VfsDirNode } from './vfs';
// Side-effect import so the registry actually has commands to complete.
import './builtins/index';

const fakeInfo = {
  name: 'Test',
  title: 'Tester',
  location: 'Nowhere',
  timezone: 'UTC',
  education: 'Testing U',
  heroMeta: 'Testing U · fixture · shell tests',
  availableForOpportunities: true,
  bio: 'bio text',
  strategicNote: 'note',
  socials: { github: 'https://github.com/t', linkedin: 'https://li/t' },
  resumeUrl: 'https://example.com/r.pdf',
  about: { paragraphs: [], currentFocusTitle: '', currentFocusDescription: '' },
  techStack: [{ category: 'Languages', items: ['TS'] }],
  experience: [],
};

function makeVfs(): VfsDirNode {
  return buildVfs(
    {
      '/src/content/projects/alpha.mdx': () => Promise.resolve('a'),
      '/src/content/projects/apex.mdx': () => Promise.resolve('b'),
      '/src/content/projects/beta.mdx': () => Promise.resolve('c'),
    },
    fakeInfo,
  );
}

test('completes command names for the first word', () => {
  const result = complete('c', 1, makeVfs(), '/');
  expect(result.candidates).toContain('cat');
  expect(result.candidates).toContain('cd');
  expect(result.candidates).toContain('clear');
  expect(result.candidates).toContain('contact');
  expect(result.replaceStart).toBe(0);
});

test('an empty first word suggests every command', () => {
  const result = complete('', 0, makeVfs(), '/');
  expect(result.candidates.length).toBeGreaterThan(5);
});

test('completes a top-level vfs path for a path-taking builtin', () => {
  const input = 'cd proj';
  const result = complete(input, input.length, makeVfs(), '/');
  expect(result.candidates).toEqual(['projects/']);
  expect(result.replaceStart).toBe(3); // start of "proj"
});

test('completes a nested vfs path once inside a directory prefix', () => {
  const input = 'cat projects/al';
  const result = complete(input, input.length, makeVfs(), '/');
  expect(result.candidates).toEqual(['projects/alpha.mdx']);
});

test('offers multiple candidates that share a prefix', () => {
  const input = 'ls projects/a';
  const result = complete(input, input.length, makeVfs(), '/');
  expect(result.candidates.sort()).toEqual([
    'projects/alpha.mdx',
    'projects/apex.mdx',
  ]);
});

test('returns no path candidates for a non-path-taking builtin', () => {
  const input = 'theme proj';
  const result = complete(input, input.length, makeVfs(), '/');
  expect(result.candidates).toEqual([]);
});

test('path completion respects the current working directory', () => {
  const input = 'ls al';
  const result = complete(input, input.length, makeVfs(), '/projects');
  expect(result.candidates).toEqual(['alpha.mdx']);
});
