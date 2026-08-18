import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Command, ShellCtx } from '../registry';
import { registerCommand } from '../registry';
import { pushHistory, getHistory } from '../history';
import { help, man, clear, history } from './misc';

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

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

const fixtureCommand: Command = {
  name: 'zzz-fixture',
  description: 'A fixture command for misc.spec.ts.',
  usage: 'zzz-fixture',
  run: () => ({ lines: [] }),
};
registerCommand(fixtureCommand);

test('help lists a registered command with its description', async () => {
  const result = await help.run([], makeCtx());
  expect(result.lines.some((l) => l.includes('zzz-fixture'))).toBe(true);
  expect(result.lines.some((l) => l.includes(fixtureCommand.description))).toBe(
    true,
  );
});

test('man prints usage and description for a known command', async () => {
  const result = await man.run(['zzz-fixture'], makeCtx());
  expect(result.lines).toEqual([
    fixtureCommand.usage,
    fixtureCommand.description,
  ]);
});

test('man errors for an unknown command', async () => {
  const result = await man.run(['nope-not-real'], makeCtx());
  expect(result.error).toBe(true);
});

test('man with no argument errors', async () => {
  const result = await man.run([], makeCtx());
  expect(result.error).toBe(true);
});

test('clear invokes ctx.clearOutput and returns no lines', async () => {
  const ctx = makeCtx();
  const result = await clear.run([], ctx);
  expect(ctx.clearOutput).toHaveBeenCalledOnce();
  expect(result.lines).toEqual([]);
});

test('history prints persisted entries with 1-based indices', async () => {
  const ctx = makeCtx({ history: ['ls', 'cd projects'] });
  const result = await history.run([], ctx);
  expect(result.lines).toEqual(['1  ls', '2  cd projects']);
});

test('history -c clears persisted (localStorage) history', async () => {
  pushHistory('ls');
  pushHistory('pwd');
  expect(getHistory().length).toBe(2);
  const result = await history.run(['-c'], makeCtx());
  expect(getHistory()).toEqual([]);
  expect(result.error).toBeFalsy();
});
