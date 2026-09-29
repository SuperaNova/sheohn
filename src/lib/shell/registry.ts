// Command registry (name -> handler) plus the shared builtin/executor types.

import type { VfsDirNode } from './vfs';
import type { RagQueryResult } from '../rag';

/** Output of running a single command (or a full pipeline). */
export interface ShellOutput {
  lines: string[];
  error?: boolean;
}

/** One entry of the deck's shell output log: a command and its output lines. */
export interface ShellLogEntry {
  command: string;
  lines: string[];
  error: boolean;
}

/** Everything a builtin needs, injected so builtins are testable with a fake ctx. */
export interface ShellCtx {
  /** Current working directory (absolute vfs path). */
  cwd: string;
  /** Root of the virtual filesystem. */
  vfs: VfsDirNode;
  /** Persisted shell history, most recent last. */
  history: string[];
  /** Update the shell's cwd (used by `cd`). */
  setCwd: (path: string) => void;
  /** Navigate to a route, closing the deck. */
  navigate: (path: string) => void;
  /** Toggle light/dark theme. */
  toggleTheme: () => void;
  /** Open the résumé PDF in a new tab. */
  openResume: () => void;
  /** Collapse the command deck. */
  closeDeck: () => void;
  /** Clear the shell output log (used by `clear`). */
  clearOutput: () => void;
  /** Latest query_jared_memory retrieval trace (for `trace`); optional, fall back to `null`. */
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
