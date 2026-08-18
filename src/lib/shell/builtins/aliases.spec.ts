import { expect, test, vi } from 'vitest';
import type { ShellCtx } from '../registry';
import { home, projects, about, contact, theme, resume } from './aliases';

function makeCtx(): ShellCtx {
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
  };
}

test('home navigates to /', () => {
  const ctx = makeCtx();
  home.run([], ctx);
  expect(ctx.navigate).toHaveBeenCalledWith('/');
});

test('projects navigates to /projects', () => {
  const ctx = makeCtx();
  projects.run([], ctx);
  expect(ctx.navigate).toHaveBeenCalledWith('/projects');
});

test('about navigates to /about', () => {
  const ctx = makeCtx();
  about.run([], ctx);
  expect(ctx.navigate).toHaveBeenCalledWith('/about');
});

test('contact navigates to /#contact', () => {
  const ctx = makeCtx();
  contact.run([], ctx);
  expect(ctx.navigate).toHaveBeenCalledWith('/#contact');
});

test('theme toggles the theme without navigating', () => {
  const ctx = makeCtx();
  theme.run([], ctx);
  expect(ctx.toggleTheme).toHaveBeenCalledOnce();
  expect(ctx.navigate).not.toHaveBeenCalled();
});

test('resume opens the résumé without navigating', () => {
  const ctx = makeCtx();
  resume.run([], ctx);
  expect(ctx.openResume).toHaveBeenCalledOnce();
  expect(ctx.navigate).not.toHaveBeenCalled();
});
