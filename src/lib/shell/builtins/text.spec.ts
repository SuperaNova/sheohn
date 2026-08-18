import { expect, test, vi } from 'vitest';
import { buildVfs, type VfsDirNode } from '../vfs';
import type { ShellCtx } from '../registry';
import { echo, grep } from './text';

const fakeInfo = {
  name: 'Test',
  title: 'Tester',
  location: 'Nowhere',
  timezone: 'UTC',
  education: 'Testing U',
  heroMeta: 'Testing U · fixture · shell tests',
  availableForOpportunities: true,
  bio: 'President of GDG on Campus, systems developer.',
  strategicNote: 'note',
  socials: { github: 'https://github.com/t', linkedin: 'https://li/t' },
  resumeUrl: 'https://example.com/r.pdf',
  about: { paragraphs: [], currentFocusTitle: '', currentFocusDescription: '' },
  techStack: [{ category: 'Languages', items: ['TS'] }],
  experience: [],
};

function makeVfs(): VfsDirNode {
  return buildVfs({}, fakeInfo);
}

function makeCtx(vfs: VfsDirNode): ShellCtx {
  return {
    cwd: '/',
    vfs,
    history: [],
    setCwd: vi.fn(),
    navigate: vi.fn(),
    toggleTheme: vi.fn(),
    openResume: vi.fn(),
    closeDeck: vi.fn(),
    clearOutput: vi.fn(),
  };
}

test('echo joins its arguments back with spaces', () => {
  expect(echo.run(['hello', 'world'], makeCtx(makeVfs()))).toEqual({
    lines: ['hello world'],
  });
});

test('grep filters piped stdin lines case-sensitively by default', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await grep.run(['GDG'], ctx, 'line one\nGDG line\nother');
  expect(result.lines).toEqual(['GDG line']);
});

test('grep -i matches case-insensitively', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await grep.run(
    ['-i', 'gdg'],
    ctx,
    'line one\nGDG line\nother',
  );
  expect(result.lines).toEqual(['GDG line']);
});

test('grep reads from a vfs file when a path argument is given', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await grep.run(['-i', 'GDG', 'facts.json'], ctx);
  expect(result.lines.some((l) => l.includes('GDG'))).toBe(true);
});

test('cat facts.json piped into grep -i GDG finds the bio line', async () => {
  const ctx = makeCtx(makeVfs());
  const factsContent = JSON.stringify([fakeInfo.bio]);
  const result = await grep.run(['-i', 'GDG'], ctx, factsContent);
  expect(result.lines).toEqual([factsContent]);
});

test('grep with no pattern errors', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await grep.run([], ctx, 'anything');
  expect(result.error).toBe(true);
});

test('grep with no matches returns an empty result, not an error', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await grep.run(['zzz-nomatch'], ctx, 'a\nb\nc');
  expect(result.lines).toEqual([]);
  expect(result.error).toBeFalsy();
});
