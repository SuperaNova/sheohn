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

// Whether the unified command deck (palette + agent) is expanded.
export const commandDeckOpen = writable<boolean>(false);

// A query pushed into the agent from elsewhere (hero starter chips, etc.).
// CommandDeck owns the Chat instance and listens here; `ts` forces re-fire
// even when the same text is sent twice.
export interface AgentQuery {
  text: string;
  ts: number;
}
export const agentQuery = writable<AgentQuery | null>(null);
let agentSeq = 0;
export function dispatchAgentQuery(text: string) {
  agentQuery.set({ text, ts: ++agentSeq });
}

// Scene control: the agent emits a command (focus_section tool) and
// ScenePilot.svelte pans to that section and spotlights it.
export type SceneTarget = 'hero' | 'about' | 'stack' | 'projects' | 'contact';

// Which section element id is currently spotlit (null = none).
export const spotlight = writable<string | null>(null);

export interface SceneCommand {
  target: SceneTarget;
  ts: number; // monotonic — forces re-trigger even on a repeat target
}
export const sceneCommand = writable<SceneCommand | null>(null);

let sceneSeq = 0;
export function dispatchScene(target: SceneTarget) {
  sceneCommand.set({ target, ts: ++sceneSeq });
}

export function clearSpotlight() {
  spotlight.set(null);
}

// Direct route navigation requested by the agent (e.g. open a case study page).
export const routeCommand = writable<{ path: string; ts: number } | null>(null);
let routeSeq = 0;
export function dispatchRoute(path: string) {
  routeCommand.set({ path, ts: ++routeSeq });
}

export const theme = writable<'light' | 'dark'>('dark');

let themeInitialized = false;

export function initTheme() {
  if (themeInitialized || typeof window === 'undefined') return;
  themeInitialized = true;

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

// Set the theme directly (used by the agent's set_theme tool).
export function setTheme(mode: 'light' | 'dark') {
  theme.set(mode);
}
