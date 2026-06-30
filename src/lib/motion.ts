/**
 * Shared reduced-motion guard for JS-driven animations.
 *
 * The global `@media (prefers-reduced-motion: reduce)` block in global.css only
 * neutralizes CSS transitions/animations. Anything driven from JavaScript
 * (rAF loops, springs, scroll parallax) has to consult the preference itself.
 * Use this at the entry point of every JS animation so the site honours the
 * promise made in PRODUCT.md: a reduced-motion path for *every* animation.
 *
 * SSR-safe: returns `false` when `window`/`matchMedia` are unavailable, so the
 * server render assumes motion is allowed and the client corrects on mount.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
