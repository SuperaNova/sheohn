import { expect, test, vi } from 'vitest';
import type { ShellCtx } from '../registry';
import * as pagefindClient from '../pagefind-client';
import { search, INDEX_UNAVAILABLE_MESSAGE } from './search';

function makeCtx(): ShellCtx {
  return {
    cwd: '/',
    vfs: { type: 'dir', name: '', path: '/', children: {} },
    history: [],
    setCwd: vi.fn(),
    navigate: vi.fn(),
    toggleTheme: vi.fn(),
    openResume: vi.fn(),
    closeDeck: vi.fn(),
    clearOutput: vi.fn(),
  };
}

test('search with no query errors', async () => {
  const result = await search.run([], makeCtx());
  expect(result.error).toBe(true);
});

test('search prints the graceful dev-mode message when the index is unavailable (search() returns null)', async () => {
  vi.spyOn(pagefindClient, 'search').mockResolvedValueOnce(null);
  const result = await search.run(['jared'], makeCtx());
  expect(result.lines).toEqual([INDEX_UNAVAILABLE_MESSAGE]);
  expect(result.error).toBeFalsy();
});

test('search reports zero matches distinctly from an unavailable index', async () => {
  vi.spyOn(pagefindClient, 'search').mockResolvedValueOnce([]);
  const result = await search.run(['zzz-no-match'], makeCtx());
  expect(result.lines).toEqual(['search: no results for "zzz-no-match"']);
  expect(result.lines).not.toContain(INDEX_UNAVAILABLE_MESSAGE);
});

test('search renders title, excerpt, and url for each real result', async () => {
  vi.spyOn(pagefindClient, 'search').mockResolvedValueOnce([
    { title: 'About', excerpt: 'Jared is a...', url: '/about/' },
  ]);
  const result = await search.run(['jared'], makeCtx());
  expect(result.lines).toEqual(['About — Jared is a... (/about/)']);
});
