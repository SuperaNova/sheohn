/**
 * Pure decision logic for the theme whoosh (View Transitions circular
 * reveal) and the quiet dark-landing entrance. DOM/browser-touching code
 * stays in store.ts / the components — this module only computes answers
 * from plain inputs so it can be unit tested without jsdom quirks.
 */

export interface Point {
  x: number;
  y: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Picks the theme-whoosh origin: the center of the first on-screen
 * (non-zero-area) toggle button rect, or the viewport's top-right corner
 * when none is visible (e.g. the toggle is hidden behind a mobile menu).
 */
export function pickToggleOrigin(
  rects: readonly Rect[],
  viewport: { width: number; height: number },
): Point {
  const visible = rects.find((r) => r.width > 0 && r.height > 0);
  if (visible) {
    return {
      x: visible.left + visible.width / 2,
      y: visible.top + visible.height / 2,
    };
  }
  return { x: viewport.width, y: 0 };
}

/** Radius a clip-path circle needs to fully cover the viewport from `origin`. */
export function whooshEndRadius(
  origin: Point,
  viewport: { width: number; height: number },
): number {
  return Math.hypot(
    Math.max(origin.x, viewport.width - origin.x),
    Math.max(origin.y, viewport.height - origin.y),
  );
}

/** True exactly when a theme change counts as "entering dark" (power-on trigger). */
export function isEnteringDark(
  previous: 'light' | 'dark',
  next: 'light' | 'dark',
): boolean {
  return previous === 'light' && next === 'dark';
}

/**
 * Gate for the once-per-session quiet dark-landing entrance (grid draw-in +
 * glow bloom, no flash/whoosh): only for visitors who land already in dark,
 * only once per session, never under reduced motion.
 */
export function shouldPlayDarkEntrance(opts: {
  theme: 'light' | 'dark';
  alreadyPlayed: boolean;
  reducedMotion: boolean;
}): boolean {
  return opts.theme === 'dark' && !opts.alreadyPlayed && !opts.reducedMotion;
}
