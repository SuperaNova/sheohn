/**
 * Reduced-motion guard for JS-driven animations (rAF, springs, parallax), which the CSS media block
 * in global.css doesn't cover. SSR-safe: returns `false` without `window`/`matchMedia`.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
