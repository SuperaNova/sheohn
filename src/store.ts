import { writable, derived, get } from 'svelte/store';
import type { RagQueryResult } from './lib/rag';
import { pickToggleOrigin, whooshEndRadius } from './lib/theme-transition';

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

// A query pushed into the agent from elsewhere; `ts` re-fires repeated identical text.
interface AgentQuery {
  text: string;
  ts: number;
}
export const agentQuery = writable<AgentQuery | null>(null);
let agentSeq = 0;
export function dispatchAgentQuery(text: string) {
  agentQuery.set({ text, ts: ++agentSeq });
}

// Scene control: the agent's focus_section command, consumed by ScenePilot.
export type SceneTarget = 'hero' | 'about' | 'stack' | 'projects' | 'contact';

// Which section element id is currently spotlit (null = none).
export const spotlight = writable<string | null>(null);

interface SceneCommand {
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

// Direct route navigation requested by the agent.
export const routeCommand = writable<{ path: string; ts: number } | null>(null);
let routeSeq = 0;
export function dispatchRoute(path: string) {
  routeCommand.set({ path, ts: ++routeSeq });
}

// BaseLayout's pre-paint script already applied the theme (?theme= override, storage, else
// light) and the .dark class; read it here or that override is reverted on hydration.
const initialTheme: 'light' | 'dark' =
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('dark')
    ? 'dark'
    : 'light';

export const theme = writable<'light' | 'dark'>(initialTheme);

// True while >=50% of the home hero is on screen; drives the deck's perched state.
export const heroInView = writable(false);

const THEME_COLOR: Record<'light' | 'dark', string> = {
  light: '#f3efe8',
  dark: '#050505',
};

let themeInitialized = false;

export function initTheme() {
  if (themeInitialized || typeof window === 'undefined') return;
  themeInitialized = true;

  theme.subscribe(($theme) => {
    document.documentElement.classList.toggle('dark', $theme === 'dark');
    window.localStorage.setItem('theme', $theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[$theme]);
  });
}

// Center of the visible theme-toggle (desktop or mobile markup); falls back to top-right.
function getToggleOrigin() {
  const rects = Array.from(
    document.querySelectorAll<HTMLElement>('[data-theme-toggle]'),
  ).map((el) => el.getBoundingClientRect());
  return pickToggleOrigin(rects, {
    width: window.innerWidth,
    height: window.innerHeight,
  });
}

let whooshBusy = false;

// Shared by the toggle and set_theme: circular View Transitions reveal, instant swap without
// the API or under prefers-reduced-motion. Ignores calls while one is in flight.
function runThemeWhoosh(next: 'light' | 'dark') {
  if (whooshBusy) return;

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (
    typeof document === 'undefined' ||
    reduced ||
    !document.startViewTransition
  ) {
    theme.set(next);
    return;
  }

  whooshBusy = true;
  const root = document.documentElement;
  const origin = getToggleOrigin();
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const endRadius = whooshEndRadius(origin, viewport);

  // Scopes the whoosh's crossfade CSS so it doesn't leak into ClientRouter transitions.
  root.setAttribute('data-theme-whoosh', '');

  const transition = document.startViewTransition(() => theme.set(next));
  transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${origin.x}px ${origin.y}px)`,
            `circle(${endRadius}px at ${origin.x}px ${origin.y}px)`,
          ],
        },
        {
          duration: 750,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {
      /* transition.ready rejects if the browser skipped the transition —
         theme.set() above still ran, so the DOM is already correct. */
    });
  transition.finished.finally(() => {
    whooshBusy = false;
    root.removeAttribute('data-theme-whoosh');
  });
}

export function toggleTheme() {
  runThemeWhoosh(get(theme) === 'dark' ? 'light' : 'dark');
}

// Set the theme directly (used by set_theme).
export function setTheme(mode: 'light' | 'dark') {
  if (get(theme) === mode) return;
  runThemeWhoosh(mode);
}

// Latest query_jared_memory retrieval trace, replayed by `/trace`; null until a RAG lookup runs.
export const lastRagTrace = writable<RagQueryResult | null>(null);
