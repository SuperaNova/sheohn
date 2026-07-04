// Filesystem builtins: pwd, ls, cd, cat.

import type { Command, ShellOutput } from '../registry';
import { getNode, listDir, readFile, resolvePath } from '../vfs';

export const pwd: Command = {
  name: 'pwd',
  description: 'Print the current working directory.',
  usage: 'pwd',
  run: (_args, ctx) => ({ lines: [ctx.cwd] }),
};

export const ls: Command = {
  name: 'ls',
  description: 'List a virtual filesystem directory.',
  usage: 'ls [path]',
  run: (args, ctx): ShellOutput => {
    const target = args[0];
    const path = resolvePath(ctx.cwd, target ?? '.');
    const node = getNode(ctx.vfs, path);
    if (!node) {
      return {
        lines: [`ls: ${target ?? path}: no such file or directory`],
        error: true,
      };
    }
    if (node.type === 'file') {
      return { lines: [node.name] };
    }
    const entries = listDir(ctx.vfs, path) ?? [];
    if (!entries.length) return { lines: [] };
    return {
      lines: entries.map((e) => (e.type === 'dir' ? `${e.name}/` : e.name)),
    };
  },
};

export const cd: Command = {
  name: 'cd',
  description: 'Change the current working directory.',
  usage: 'cd [path]',
  run: (args, ctx): ShellOutput => {
    const target = args[0] ?? '/';
    const path = resolvePath(ctx.cwd, target);
    const node = getNode(ctx.vfs, path);
    if (!node || node.type !== 'dir') {
      return { lines: [`cd: ${target}: no such directory`], error: true };
    }
    ctx.setCwd(path);
    return { lines: [] };
  },
};

export const cat: Command = {
  name: 'cat',
  description: 'Print virtual filesystem file contents.',
  usage: 'cat <path> [path...]',
  run: async (args, ctx, stdin): Promise<ShellOutput> => {
    if (args.length === 0) {
      if (stdin !== undefined) return { lines: stdin.split('\n') };
      return { lines: ['cat: missing file operand'], error: true };
    }
    const outputLines: string[] = [];
    let hadError = false;
    for (const arg of args) {
      const path = resolvePath(ctx.cwd, arg);
      const content = await readFile(ctx.vfs, path);
      if (content === undefined) {
        outputLines.push(`cat: ${arg}: no such file`);
        hadError = true;
        continue;
      }
      outputLines.push(...content.split('\n'));
    }
    return { lines: outputLines, error: hadError };
  },
};
