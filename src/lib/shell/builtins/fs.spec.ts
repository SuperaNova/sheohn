import { expect, test, vi } from 'vitest';
import { buildVfs, type VfsDirNode } from '../vfs';
import type { ShellCtx } from '../registry';
import { pwd, ls, cd, cat } from './fs';

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
      '/src/content/projects/alpha.mdx': () => Promise.resolve('alpha body'),
      '/src/content/projects/beta.mdx': () => Promise.resolve('beta body'),
    },
    fakeInfo,
  );
}

function makeCtx(vfs: VfsDirNode, cwd = '/'): ShellCtx {
  return {
    cwd,
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

test('pwd prints the current working directory', () => {
  const ctx = makeCtx(makeVfs(), '/projects');
  expect(pwd.run([], ctx)).toEqual({ lines: ['/projects'] });
});

test('ls lists directory entries with trailing slashes on dirs', () => {
  const ctx = makeCtx(makeVfs());
  const result = ls.run([], ctx) as { lines: string[] };
  expect(result.lines.sort()).toEqual(['about/', 'facts.json', 'projects/']);
});

test('ls on the projects dir lists the same slugs as the content collection', () => {
  const ctx = makeCtx(makeVfs());
  const result = ls.run(['projects'], ctx) as { lines: string[] };
  expect(result.lines.sort()).toEqual(['alpha.mdx', 'beta.mdx']);
});

test('ls on a file prints just that file name', () => {
  const ctx = makeCtx(makeVfs());
  const result = ls.run(['/about/bio'], ctx) as { lines: string[] };
  expect(result.lines).toEqual(['bio']);
});

test('ls errors on a missing path', () => {
  const ctx = makeCtx(makeVfs());
  const result = ls.run(['/nope'], ctx) as { lines: string[]; error?: boolean };
  expect(result.error).toBe(true);
});

test('cd updates cwd via ctx.setCwd on a valid directory', () => {
  const ctx = makeCtx(makeVfs());
  const result = cd.run(['projects'], ctx) as { lines: string[] };
  expect(ctx.setCwd).toHaveBeenCalledWith('/projects');
  expect(result.lines).toEqual([]);
});

test('cd errors and does not call setCwd on an invalid directory', () => {
  const ctx = makeCtx(makeVfs());
  const result = cd.run(['nope'], ctx) as { lines: string[]; error?: boolean };
  expect(ctx.setCwd).not.toHaveBeenCalled();
  expect(result.error).toBe(true);
});

test('cd with no args resolves to root', () => {
  const ctx = makeCtx(makeVfs(), '/about');
  cd.run([], ctx);
  expect(ctx.setCwd).toHaveBeenCalledWith('/');
});

test('cat prints a project file raw content', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await cat.run(['/projects/alpha.mdx'], ctx);
  expect(result.lines).toEqual(['alpha body']);
});

test('cat reports a missing file without throwing', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await cat.run(['/nope.md'], ctx);
  expect(result.error).toBe(true);
  expect(result.lines[0]).toContain('no such file');
});

test('cat with no args and no stdin errors', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await cat.run([], ctx);
  expect(result.error).toBe(true);
});

test('cat with no args but piped stdin passes it through', async () => {
  const ctx = makeCtx(makeVfs());
  const result = await cat.run([], ctx, 'piped line');
  expect(result.lines).toEqual(['piped line']);
});
