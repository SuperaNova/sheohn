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

  // Maps an agent scene target to a DOM element id + the route it lives on.
  const MAP: Record<SceneTarget, { id: string; route: string }> = {
    hero: { id: 'home', route: '/' },
    projects: { id: 'projects', route: '/' },
    contact: { id: 'contact', route: '/' },
    about: { id: 'about', route: '/about' },
    stack: { id: 'stack', route: '/about' },
  };

  const HEADER_OFFSET = 88; // clears the fixed top nav
  const SCROLL_MS = 950; // deliberate, camera-like pan
  const SPOTLIGHT_MS = 3600;

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
  function cinematicScrollTo(el: HTMLElement) {
    cancelAnimationFrame(scrollRaf);
    const startY = window.scrollY;
    const targetY = Math.max(
      0,
      startY + el.getBoundingClientRect().top - HEADER_OFFSET,
    );

    if (prefersReduced()) {
      window.scrollTo(0, targetY);
      return;
    }

    const dist = targetY - startY;
    if (Math.abs(dist) < 4) return;
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min((now - start) / SCROLL_MS, 1);
      // easeInOutCubic — slow start, slow stop
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo(0, startY + dist * eased);
      if (t < 1) scrollRaf = requestAnimationFrame(step);
    };
    scrollRaf = requestAnimationFrame(step);
  }

  // Light a section up, then pan to it. Returns false if not on this page.
  function spotlightId(id: string): boolean {
    const el = document.getElementById(id);
    if (!el) return false;
    spotlight.set(id); // dim + flash begin as the camera starts moving
    cinematicScrollTo(el);
    clearTimeout(clearTimer);
    clearTimer = window.setTimeout(clearSpotlight, SPOTLIGHT_MS);
    return true;
  }

  function run(target: SceneTarget) {
    const entry = MAP[target];
    if (!entry) return;
    if (!spotlightId(entry.id)) {
      // Section lives on another page. Navigate to the route WITHOUT a hash
      // (so we land at the top), then pan down to it after the swap — that
      // gives a visible scroll instead of an instant jump to the anchor.
      sessionStorage.setItem('scene-pending', entry.id);
      navigate(entry.route);
    }
  }

  onMount(() => {
    // 1. React to agent scene commands.
    const unsubCmd = sceneCommand.subscribe((cmd) => {
      if (cmd && cmd.ts !== lastTs) {
        lastTs = cmd.ts;
        run(cmd.target);
      }
    });

    // 1b. React to direct route navigation (e.g. open a case study page).
    const unsubRoute = routeCommand.subscribe((cmd) => {
      if (cmd && cmd.ts !== lastRouteTs) {
        lastRouteTs = cmd.ts;
        navigate(cmd.path);
      }
    });

    // 2. Reflect spotlight state into the DOM (dim the rest, light the target).
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

    // 3. After a cross-page navigation, finish the pending spotlight + pan.
    //    astro:page-load fires on first load AND after every view transition.
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

<!-- Invisible controller; renders nothing. -->
