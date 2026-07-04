// The command registry: a name → handler map that builtins register
// themselves into, plus the shared types every builtin/executor speaks.

import type { VfsDirNode } from './vfs';
import type { RagQueryResult } from '../rag';

/** Output of running a single command (or a full pipeline). */
export interface ShellOutput {
  lines: string[];
  error?: boolean;
}

/** One entry in CommandDeck's shell output log — a submitted command and
 * the lines it produced. */
export interface ShellLogEntry {
  command: string;
  lines: string[];
  error: boolean;
}

/**
 * Everything a builtin needs, injected rather than imported, so builtins
 * stay pure-ish and testable with a fake ctx (no real store.ts/DOM needed).
 */
export interface ShellCtx {
  /** Current working directory (absolute vfs path). */
  cwd: string;
  /** Root of the virtual filesystem. */
  vfs: VfsDirNode;
  /** Persisted shell history, most recent last. */
  history: string[];
  /** Update the shell's cwd (used by `cd`). */
  setCwd: (path: string) => void;
  /** Navigate the site to a route, closing the deck (mirrors the old `goto`). */
  navigate: (path: string) => void;
  /** Toggle light/dark theme. */
  toggleTheme: () => void;
  /** Open the résumé PDF in a new tab. */
  openResume: () => void;
  /** Collapse the command deck. */
  closeDeck: () => void;
  /** Clear the shell output log (used by `clear`). */
  clearOutput: () => void;
  /** Most recent query_jared_memory retrieval trace (used by `trace`).
   * Optional so existing ShellCtx literals elsewhere don't need updating —
   * builtins that use it should fall back to `null` when absent. */
  getLastRagTrace?: () => RagQueryResult | null;
}

type CommandRun = (
  args: string[],
  ctx: ShellCtx,
  stdin?: string,
) => ShellOutput | Promise<ShellOutput>;

export interface Command {
  name: string;
  description: string;
  usage: string;
  run: CommandRun;
}

export const registry = new Map<string, Command>();

export function registerCommand(cmd: Command): void {
  registry.set(cmd.name, cmd);
}

export function getCommand(name: string): Command | undefined {
  return registry.get(name);
}

export function listCommands(): Command[] {
  return [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
}
