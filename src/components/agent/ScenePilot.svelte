<script lang="ts">
  import { onMount } from 'svelte';
  import { navigate } from 'astro:transitions/client';
  import {
    sceneCommand,
    routeCommand,
    spotlight,
    clearSpotlight,
    type SceneTarget,
  } from '../../store';

  // Scroll + highlight animations driven by the `sceneCommand` store (focus_section tool).
  // Maps an agent scene target to a DOM element id + the route it lives on.
  const MAP: Record<SceneTarget, { id: string; route: string }> = {
    hero: { id: 'home', route: '/' },
    projects: { id: 'projects', route: '/projects' },
    contact: { id: 'contact', route: '/' },
    about: { id: 'about', route: '/about' },
    stack: { id: 'stack', route: '/about' },
  };

  const HEADER_OFFSET = 88; // clears the fixed top nav
  const SCROLL_MS = 950; // deliberate, camera-like pan
  const DWELL_MS = 700; // how long the highlight lingers AFTER the pan settles

  let clearTimer = 0;
  let scrollRaf = 0;
  let lastTs = 0;
  let lastRouteTs = 0;

  function prefersReduced() {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  // Custom eased scroll — browsers don't let you control native smooth-scroll
  // speed, and this needs to feel like a slow camera pan, not a snap.
  function cinematicScrollTo(el: HTMLElement, onDone?: () => void) {
    cancelAnimationFrame(scrollRaf);
    const startY = window.scrollY;
    const targetY = Math.max(
      0,
      startY + el.getBoundingClientRect().top - HEADER_OFFSET,
    );

    if (prefersReduced()) {
      window.scrollTo(0, targetY);
      onDone?.();
      return;
    }

    const dist = targetY - startY;
    if (Math.abs(dist) < 4) {
      onDone?.();
      return;
    }
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min((now - start) / SCROLL_MS, 1);
      // easeInOutCubic — slow start, slow stop
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo(0, startY + dist * eased);
      if (t < 1) scrollRaf = requestAnimationFrame(step);
      else onDone?.();
    };
    scrollRaf = requestAnimationFrame(step);
  }

  // Light a section up, then pan to it. Returns false if not on this page.
  function spotlightId(id: string): boolean {
    const el = document.getElementById(id);
    if (!el) return false;
    spotlight.set(id); // dim + flash begin as the camera starts moving
    clearTimeout(clearTimer);
    // Lift the dim once the pan settles plus a dwell, so slow replies never leave the page blurred.
    cinematicScrollTo(el, () => {
      clearTimeout(clearTimer);
      clearTimer = window.setTimeout(clearSpotlight, DWELL_MS);
    });
    return true;
  }

  function currentPath(): string {
    const p = window.location.pathname;
    return p === '/index.html' ? '/' : p;
  }

  function run(target: SceneTarget) {
    const entry = MAP[target];
    if (!entry) return;
    // Spotlight in place if already on the target's route; otherwise navigate, then pan
    // (a visible scroll, not an anchor jump).
    if (currentPath() === entry.route) {
      spotlightId(entry.id);
    } else {
      sessionStorage.setItem('scene-pending', entry.id);
      navigate(entry.route);
    }
  }

  onMount(() => {
    const unsubCmd = sceneCommand.subscribe((cmd) => {
      if (cmd && cmd.ts !== lastTs) {
        lastTs = cmd.ts;
        run(cmd.target);
      }
    });

    const unsubRoute = routeCommand.subscribe((cmd) => {
      if (cmd && cmd.ts !== lastRouteTs) {
        lastRouteTs = cmd.ts;
        navigate(cmd.path);
      }
    });

    const unsubSpot = spotlight.subscribe((id) => {
      document
        .querySelectorAll('.is-spotlit')
        .forEach((e) => e.classList.remove('is-spotlit'));
      if (id) {
        document.getElementById(id)?.classList.add('is-spotlit');
        document.body.classList.add('scene-dimmed');
      } else {
        document.body.classList.remove('scene-dimmed');
      }
    });

    // After cross-page navigation, finish the pending spotlight; astro:page-load fires on
    // first load and after every view transition.
    const onPageLoad = () => {
      const pending = sessionStorage.getItem('scene-pending');
      if (pending) {
        sessionStorage.removeItem('scene-pending');
        // Let the new page lay out (and SectionReveal settle) before panning.
        setTimeout(() => spotlightId(pending), 220);
      }
    };
    document.addEventListener('astro:page-load', onPageLoad);
    onPageLoad();

    return () => {
      unsubCmd();
      unsubRoute();
      unsubSpot();
      document.removeEventListener('astro:page-load', onPageLoad);
      clearTimeout(clearTimer);
      cancelAnimationFrame(scrollRaf);
    };
  });
</script>
