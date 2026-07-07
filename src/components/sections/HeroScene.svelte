<script lang="ts">
  // Dark-hero pastel-phosphor scene (spec 18, task T1). Purely decorative —
  // skybox, stars, a slatted paper sun, horizon glow, a rolling perspective
  // grid, scanlines, and a vignette. Rendered always but hidden in light via
  // `html.dark`-gated CSS (display:none is cheap, no hydration cost — see
  // the .site-noise comment in global.css for why this repo avoids paying
  // for permanent full-viewport compositing). Colors/positions come from the
  // `--color-scene-*` tokens and the `/* hero scene composition */` tunables
  // block in src/styles/global.css; values were copied from
  // src/pages/prototype-dark-hero.astro (the visual source of truth).
  //
  // The grid-roll/twinkle animations pause via IntersectionObserver whenever
  // this scene scrolls offscreen, and never run at all in light mode or
  // under reduced motion (see the component's style block below).
  import { prefersReducedMotion } from '../../lib/motion';

  let root: HTMLDivElement | undefined = $state();
  let paused = $state(false);

  $effect(() => {
    if (!root || prefersReducedMotion()) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        paused = !(entry?.isIntersecting ?? false);
      },
      { threshold: 0 },
    );
    observer.observe(root);

    return () => observer.disconnect();
  });
</script>

<div
  bind:this={root}
  class="scene"
  class:scene-paused={paused}
  aria-hidden="true"
>
  <div class="scene-skybox">
    <div class="scene-stars scene-stars-a"></div>
    <div class="scene-stars scene-stars-b"></div>
    <div class="scene-sun"></div>
  </div>
  <div class="scene-glow"></div>
  <div class="scene-horizon"></div>
  <div class="scene-grid-wrap"><div class="scene-grid"></div></div>
  <div class="scene-scanlines"></div>
  <div class="scene-vignette"></div>
</div>

<style>
  /* Dark-only, decorative, inert. Kept display:none in light mode so it
     never costs a hydration/paint cycle there. */
  .scene {
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    display: none;
    pointer-events: none;
  }

  :global(html.dark) .scene {
    display: block;
  }

  .scene-skybox {
    position: absolute;
    inset: 0 0 var(--scene-horizon-y) 0;
    overflow: hidden;
    background: linear-gradient(
      to bottom,
      var(--color-scene-sky-0) 0%,
      var(--color-scene-sky-1) 55%,
      var(--color-scene-sky-2) 100%
    );
  }

  .scene-stars {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(
        1px 1px at 22% 28%,
        var(--color-scene-star-cream-1),
        transparent
      ),
      radial-gradient(
        1px 1px at 68% 14%,
        var(--color-scene-star-cream-2),
        transparent
      ),
      radial-gradient(
        1.5px 1.5px at 84% 42%,
        var(--color-scene-star-seafoam-1),
        transparent
      ),
      radial-gradient(
        1px 1px at 42% 62%,
        var(--color-scene-star-cream-3),
        transparent
      ),
      radial-gradient(
        1px 1px at 8% 74%,
        var(--color-scene-star-seafoam-2),
        transparent
      );
    background-size: 340px 260px;
  }

  .scene-stars-b {
    background-size: 520px 380px;
    opacity: 0.7;
  }

  /* Static frame first (opacity: 1 base case below covers reduced motion +
     light mode, where the rule below never applies): the twinkle/roll
     animations only exist at all when motion is allowed. */
  @media (prefers-reduced-motion: no-preference) {
    .scene-stars {
      animation: scene-twinkle 5.5s ease-in-out infinite alternate;
    }
    .scene-stars-b {
      animation-duration: 8s;
      animation-delay: 2s;
    }
    .scene-grid {
      animation: scene-roll 2.8s linear infinite;
    }
  }

  @keyframes scene-twinkle {
    from {
      opacity: 0.45;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scene-roll {
    to {
      background-position-y: 64px;
    }
  }

  /* Offscreen pause: `paused` is toggled by the IntersectionObserver above
     and applied via `class:scene-paused` so the class appears statically in
     the template — Svelte's unused-CSS-selector pruning only sees classes
     added purely at runtime via classList and would otherwise strip this
     rule (see spec 18 landmine #2). Also wrapped in :global() defensively
     for the same reason. */
  :global(.scene-paused) .scene-stars,
  :global(.scene-paused) .scene-grid {
    animation-play-state: paused;
  }

  /* paper sun — pale disc with slats, half-set behind the horizon */
  .scene-sun {
    position: absolute;
    left: var(--scene-sun-x);
    bottom: calc(-1 * var(--scene-sun-drop));
    translate: -50% 0;
    width: var(--scene-sun-size);
    aspect-ratio: 1;
    border-radius: 50%;
    background: linear-gradient(
      to bottom,
      var(--color-scene-sun-top) 0%,
      var(--color-scene-sun-mid) 55%,
      var(--color-scene-sun-bottom) 100%
    );
    mask-image: repeating-linear-gradient(
      to bottom,
      black 0 16px,
      transparent 16px 20px
    );
    filter: drop-shadow(0 0 60px var(--color-scene-glow-shadow));
  }

  .scene-glow {
    position: absolute;
    left: 50%;
    bottom: calc(var(--scene-horizon-y) - 6vh);
    translate: -50% 0;
    width: 130vw;
    height: 34vh;
    background: radial-gradient(
      ellipse 50% 60% at 50% 100%,
      var(--color-scene-glow) 0%,
      var(--color-scene-glow-soft) 45%,
      transparent 75%
    );
  }

  .scene-horizon {
    position: absolute;
    left: 0;
    right: 0;
    bottom: var(--scene-horizon-y);
    height: 2px;
    background: linear-gradient(
      to right,
      transparent,
      var(--color-scene-horizon-line) 30%,
      var(--color-scene-horizon-line) 70%,
      transparent
    );
    opacity: 0.7;
    box-shadow: 0 0 22px 2px var(--color-scene-glow);
  }

  .scene-grid-wrap {
    position: absolute;
    left: -20vw;
    right: -20vw;
    bottom: 0;
    height: var(--scene-horizon-y);
    perspective: 280px;
    perspective-origin: 50% 0;
    overflow: hidden;
    background: linear-gradient(
      to bottom,
      var(--color-scene-sky-2),
      var(--color-scene-sky-0) 90%
    );
    mask-image: linear-gradient(to bottom, transparent 0, black 12%);
  }

  .scene-grid {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 500%;
    transform-origin: top center;
    transform: rotateX(77deg);
    background-image:
      linear-gradient(
        to right,
        var(--color-scene-grid-line) 2px,
        transparent 2px
      ),
      linear-gradient(
        to bottom,
        var(--color-scene-grid-line) 2px,
        transparent 2px
      );
    background-size: 64px 64px;
    filter: drop-shadow(0 0 6px var(--color-scene-grid-shadow));
  }

  .scene-scanlines {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      to bottom,
      var(--color-scene-scanline) 0 1px,
      transparent 1px 4px
    );
    opacity: 0.35;
  }

  .scene-vignette {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse 90% 90% at 50% 45%,
      transparent 55%,
      var(--color-scene-vignette) 100%
    );
  }
</style>
