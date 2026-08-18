// Text builtins: echo, grep.

import type { Command, ShellCtx, ShellOutput } from '../registry';
import { readFile, resolvePath } from '../vfs';

export const echo: Command = {
  name: 'echo',
  description: 'Print arguments back out.',
  usage: 'echo [text...]',
  run: (args): ShellOutput => ({ lines: [args.join(' ')] }),
};

/** Case-sensitive/insensitive substring search — not a full regex engine. */
function matches(line: string, pattern: string, ignoreCase: boolean): boolean {
  if (!ignoreCase) return line.includes(pattern);
  return line.toLowerCase().includes(pattern.toLowerCase());
}

export const grep: Command = {
  name: 'grep',
  description: 'Search stdin or vfs files for a substring (supports -i).',
  usage: 'grep [-i] <pattern> [path...]',
  run: async (args, ctx: ShellCtx, stdin): Promise<ShellOutput> => {
    let ignoreCase = false;
    const positional: string[] = [];
    for (const arg of args) {
      if (arg === '-i') ignoreCase = true;
      else positional.push(arg);
    }
    const pattern = positional[0];
    if (!pattern) return { lines: ['grep: missing pattern'], error: true };
    const fileArgs = positional.slice(1);

    let sourceLines: string[];
    if (fileArgs.length > 0) {
      sourceLines = [];
      for (const arg of fileArgs) {
        const path = resolvePath(ctx.cwd, arg);
        const content = await readFile(ctx.vfs, path);
        if (content === undefined) {
          return { lines: [`grep: ${arg}: no such file`], error: true };
        }
        sourceLines.push(...content.split('\n'));
      }
    } else {
      sourceLines = (stdin ?? '').split('\n');
    }

    return {
      lines: sourceLines.filter((line) => matches(line, pattern, ignoreCase)),
    };
  },
};
