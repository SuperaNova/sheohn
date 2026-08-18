// Tab completion: command names when completing the first word, vfs
// entries when completing a path argument for path-taking builtins.

import { registry } from './registry';
import { listDir, resolvePath, type VfsDirNode, type VfsEntry } from './vfs';

const PATH_COMMANDS = new Set(['cd', 'cat', 'ls', 'grep']);

export interface CompletionResult {
  candidates: string[];
  /** Index into the input string where the token being completed starts. */
  replaceStart: number;
}

const EMPTY: CompletionResult = { candidates: [], replaceStart: 0 };

/**
 * Returns completion candidates for `input` at `cursor`. Command names are
 * suggested while completing the first word; vfs paths are suggested for
 * the arguments of path-taking builtins (`cd`, `cat`, `ls`, `grep`).
 */
export function complete(
  input: string,
  cursor: number,
  vfs: VfsDirNode,
  cwd: string,
): CompletionResult {
  const before = input.slice(0, cursor);
  const tokenMatch = /(\S*)$/.exec(before);
  const partial = tokenMatch?.[1] ?? '';
  const tokenStart = cursor - partial.length;

  const completingFirstWord = before.trimStart().indexOf(' ') === -1;
  if (completingFirstWord) {
    const candidates = [...registry.keys()]
      .filter((name) => name.startsWith(partial))
      .sort();
    return { candidates, replaceStart: tokenStart };
  }

  const firstToken = before.trim().split(/\s+/)[0] ?? '';
  if (!PATH_COMMANDS.has(firstToken))
    return { ...EMPTY, replaceStart: tokenStart };

  const lastSlash = partial.lastIndexOf('/');
  const dirPrefix = lastSlash >= 0 ? partial.slice(0, lastSlash + 1) : '';
  const namePrefix = lastSlash >= 0 ? partial.slice(lastSlash + 1) : partial;
  const dirPath = resolvePath(cwd, dirPrefix || '.');
  const entries: VfsEntry[] = listDir(vfs, dirPath) ?? [];

  const candidates = entries
    .filter((e) => e.name.startsWith(namePrefix))
    .map((e) => dirPrefix + e.name + (e.type === 'dir' ? '/' : ''))
    .sort();

  return { candidates, replaceStart: tokenStart };
}
