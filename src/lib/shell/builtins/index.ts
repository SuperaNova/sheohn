// Registers every builtin into the shared registry. Import this module once
// (from executor.ts) before running any command.

import { registerCommand, type Command } from '../registry';
import { pwd, ls, cd, cat } from './fs';
import { echo, grep } from './text';
import { help, man, clear, history } from './misc';
import { home, projects, about, contact, theme, resume } from './aliases';

const allBuiltins: Command[] = [
  pwd,
  ls,
  cd,
  cat,
  echo,
  grep,
  help,
  man,
  clear,
  history,
  home,
  projects,
  about,
  contact,
  theme,
  resume,
];

for (const cmd of allBuiltins) registerCommand(cmd);
