import { writable, derived } from 'svelte/store';

export const activeFocus = writable<string | null>(null);
export const overlayActive = derived(activeFocus, ($f) => !!$f);

export const scrollState = writable({
  scrollY: 0,
  scrollHeight: 0,
  innerHeight: 0,
});

export function setFocus(focus: string | null) {
  activeFocus.set(focus);
}

export function clearFocus() {
  activeFocus.set(null);
}

export const commandPaletteOpen = writable<boolean>(false);

export const theme = writable<'light' | 'dark'>('dark');

export function initTheme() {
  if (typeof window === 'undefined') return;
  const saved = window.localStorage.getItem('theme');
  const initialTheme =
    saved === 'light' || saved === 'dark'
      ? saved
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  theme.set(initialTheme);
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');

  theme.subscribe(($theme) => {
    document.documentElement.classList.toggle('dark', $theme === 'dark');
    window.localStorage.setItem('theme', $theme);
  });
}

export function toggleTheme() {
  theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
}
