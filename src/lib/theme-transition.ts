/** Pure decision logic for the theme whoosh and the dark-landing entrance; DOM code stays elsewhere. */

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

/** Whoosh origin: center of the first non-zero-area toggle rect, else the top-right corner. */
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

/** Gate for the quiet dark-landing entrance: lands in dark, once per session, not under reduced motion. */
export function shouldPlayDarkEntrance(opts: {
  theme: 'light' | 'dark';
  alreadyPlayed: boolean;
  reducedMotion: boolean;
}): boolean {
  return opts.theme === 'dark' && !opts.alreadyPlayed && !opts.reducedMotion;
}
