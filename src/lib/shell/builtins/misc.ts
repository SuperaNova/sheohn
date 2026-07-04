// Misc builtins: help, man, clear, history.

import type { Command, ShellOutput } from '../registry';
import { listCommands, getCommand } from '../registry';
import { clearHistory } from '../history';

export const help: Command = {
  name: 'help',
  description: 'List every available command.',
  usage: 'help',
  run: (): ShellOutput => ({
    lines: listCommands().map((c) => `${c.name.padEnd(10)} ${c.description}`),
  }),
};

export const man: Command = {
  name: 'man',
  description: "Show a command's usage and description.",
  usage: 'man <command>',
  run: (args): ShellOutput => {
    const name = args[0];
    if (!name) return { lines: ['man: missing command name'], error: true };
    const cmd = getCommand(name);
    if (!cmd)
      return { lines: [`man: no manual entry for ${name}`], error: true };
    return { lines: [cmd.usage, cmd.description] };
  },
};

export const clear: Command = {
  name: 'clear',
  description: 'Clear the shell output log.',
  usage: 'clear',
  run: (_args, ctx): ShellOutput => {
    ctx.clearOutput();
    return { lines: [] };
  },
};

export const history: Command = {
  name: 'history',
  description: 'Print, or clear (-c), persisted command history.',
  usage: 'history [-c]',
  run: (args, ctx): ShellOutput => {
    if (args.includes('-c')) {
      clearHistory();
      return { lines: ['history cleared'] };
    }
    return { lines: ctx.history.map((entry, i) => `${i + 1}  ${entry}`) };
  },
};
