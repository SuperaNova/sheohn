import { expect, test, vi } from 'vitest';
import { execute } from './executor';
import { buildVfs, type VfsDirNode } from './vfs';
import type { ShellCtx } from './registry';

const fakeInfo = {
  name: 'Test',
  title: 'Tester',
  location: 'Nowhere',
  timezone: 'UTC',
  education: 'Testing U',
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

test('an unrecognized first command is reported as not recognized', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await execute('tell me about Jared', ctx);
  expect(result.recognized).toBe(false);
});

test('empty input is recognized as a silent no-op', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await execute('   ', ctx);
  expect(result.recognized).toBe(true);
  expect(result.output.lines).toEqual([]);
});

test('runs a single recognized command', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await execute('pwd', ctx);
  expect(result.recognized).toBe(true);
  expect(result.output.lines).toEqual(['/']);
});

test('pipes stdout from one stage into the next stage stdin', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await execute('cat facts.json | grep -i GDG', ctx);
  expect(result.recognized).toBe(true);
  expect(result.output.error).toBeFalsy();
  expect(result.output.lines.some((l) => l.includes('GDG'))).toBe(true);
});

test('an unknown command mid-pipeline is reported as an executor error', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await execute('echo hi | bogus-command', ctx);
  expect(result.recognized).toBe(true);
  expect(result.output.error).toBe(true);
  expect(result.output.lines[0]).toContain('command not found');
});
