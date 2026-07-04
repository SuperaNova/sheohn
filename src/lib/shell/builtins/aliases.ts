// Aliases for the six original CommandDeck slash commands. Each calls the
// same ctx callback the old `DeckCommand.run` used to call directly, so
// behavior (navigate + close deck, toggle theme, open résumé) is unchanged.

import type { Command, ShellOutput } from '../registry';

function navAlias(name: string, path: string, description: string): Command {
  return {
    name,
    description,
    usage: name,
    run: (_args, ctx): ShellOutput => {
      ctx.navigate(path);
      return { lines: [] };
    },
  };
}

export const home = navAlias('home', '/', 'Go to home.');
export const projects = navAlias('projects', '/projects', 'Go to projects.');
export const about = navAlias('about', '/about', 'Go to about.');
export const contact = navAlias('contact', '/#contact', 'Go to contact.');

export const theme: Command = {
  name: 'theme',
  description: 'Toggle dark / light theme.',
  usage: 'theme',
  run: (_args, ctx): ShellOutput => {
    ctx.toggleTheme();
    return { lines: ['toggled theme'] };
  },
};

export const resume: Command = {
  name: 'resume',
  description: 'Open résumé (pdf) in a new tab.',
  usage: 'resume',
  run: (_args, ctx): ShellOutput => {
    ctx.openResume();
    return { lines: ['opening résumé…'] };
  },
};
