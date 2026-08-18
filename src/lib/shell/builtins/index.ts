// Registers every builtin into the shared registry. Import this module once
// (from executor.ts) before running any command.

import { registerCommand, type Command } from '../registry';
import { pwd, ls, cd, cat } from './fs';
import { echo, grep } from './text';
import { help, man, clear, history } from './misc';
import { home, projects, about, contact, theme, resume } from './aliases';
import { search } from './search';
import { trace } from './trace';

const allBuiltins: Command[] = [
  pwd,
  ls,
  cd,
  cat,
  echo,
  grep,
  search,
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
  trace,
];

for (const cmd of allBuiltins) registerCommand(cmd);
