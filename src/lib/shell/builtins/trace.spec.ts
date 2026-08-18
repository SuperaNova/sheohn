import { expect, test, vi } from 'vitest';
import type { ShellCtx } from '../registry';
import type { RagQueryResult } from '../../rag';
import { trace } from './trace';

function makeCtx(overrides: Partial<ShellCtx> = {}): ShellCtx {
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
    ...overrides,
  };
}

test('trace reports no retrieval yet when getLastRagTrace is absent', async () => {
  const result = await trace.run([], makeCtx());
  expect(result.lines[0]).toMatch(/no retrieval yet/i);
});

test('trace reports no retrieval yet when the stored trace is null', async () => {
  const ctx = makeCtx({ getLastRagTrace: () => null });
  const result = await trace.run([], ctx);
  expect(result.lines[0]).toMatch(/no retrieval yet/i);
});

test('trace renders the stored query, kept facts, and filtered-out candidates', async () => {
  const stored: RagQueryResult = {
    query: 'What leadership roles does Jared hold?',
    facts: [
      { id: 'a', text: 'President of GDG on Campus CIT-U.', score: 0.81 },
    ],
    filteredOut: [
      { id: 'b', text: 'AWS Cloud Club chapter operations.', score: 0.6 },
    ],
  };
  const ctx = makeCtx({ getLastRagTrace: () => stored });
  const result = await trace.run([], ctx);
  const joined = result.lines.join('\n');

  expect(joined).toContain(stored.query);
  expect(joined).toContain('President of GDG on Campus CIT-U.');
  expect(joined).toContain('AWS Cloud Club chapter operations.');
  expect(result.error).toBeFalsy();
});
