<script lang="ts">
  // Dark-hero pastel-phosphor scene: decorative skybox, stars, slatted
  // paper sun, horizon glow, rolling grid, scanlines, vignette. Dark-only
  // (display:none in light); colors/geometry come from the --color-scene-*
  // tokens and tunables block in global.css. Confined to the hero section —
  // animations pause when it scrolls offscreen and never run under reduced
  // motion.
  import { prefersReducedMotion } from '../../lib/motion';

  // Both flags are driven by HeroSection (which watches the theme store) —
  // powering = full power-on choreography on toggling into dark, entrance =
  // the quieter once-per-session grid/glow-only dark-landing entrance.
  let {
    powering = false,
    entrance = false,
  }: { powering?: boolean; entrance?: boolean } = $props();

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
  class:scene-powering={powering}
  class:scene-entrance={entrance}
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
  <div class="scene-sweep"></div>
  <div class="scene-scanlines"></div>
  <div class="scene-vignette"></div>
</div>

<style>
  /* Confined to the hero: z-index:-1 inside the section's `isolate`
     context paints behind the hero content only. */
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

  /* Animations exist only when motion is allowed; the base styles are a
     correct static frame. */
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

  /* `class:scene-paused` keeps the class in the template so Svelte's
     unused-CSS pruning can't strip this rule. */
  :global(.scene-paused) .scene-stars,
  :global(.scene-paused) .scene-grid {
    animation-play-state: paused;
  }

  /* Power-on choreography (toggling into dark) and the quieter dark-landing
     entrance (already dark on load) — both toggled by HeroSection reacting
     to the theme store, both classes kept in the template via `class:` so
     Svelte can't prune these rules. Grid draw-in + glow bloom play for
     both; sun-rise and the scanline sweep are power-on only. */
  @media (prefers-reduced-motion: no-preference) {
    .scene-powering .scene-grid-wrap,
    .scene-entrance .scene-grid-wrap {
      animation: scene-grid-in 1s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .scene-powering .scene-glow,
    .scene-entrance .scene-glow,
    .scene-powering .scene-horizon,
    .scene-entrance .scene-horizon {
      animation: scene-bloom 1.3s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .scene-powering .scene-sun {
      animation: scene-sunrise 1.5s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .scene-powering .scene-sweep {
      animation: scene-sweep-down 1.1s ease-out 0.25s both;
    }
  }

  @keyframes scene-grid-in {
    from {
      opacity: 0;
      transform: translateY(7vh);
    }
  }

  @keyframes scene-bloom {
    from {
      opacity: 0;
      transform: scaleX(0.55);
    }
  }

  @keyframes scene-sunrise {
    from {
      transform: translateY(9vh);
      opacity: 0;
    }
  }

  @keyframes scene-sweep-down {
    0% {
      transform: translateY(0);
      opacity: 1;
    }
    100% {
      transform: translateY(130vh);
      opacity: 0;
    }
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

  /* One-shot scanline sweep, played only during the power-on choreography
     (see .scene-powering below) — invisible at rest. */
  .scene-sweep {
    position: absolute;
    left: 0;
    right: 0;
    top: -22vh;
    height: 20vh;
    background: linear-gradient(
      to bottom,
      transparent,
      color-mix(in srgb, var(--color-scene-glow) 15%, transparent) 60%,
      color-mix(in srgb, var(--color-scene-glow) 29%, transparent)
    );
    opacity: 0;
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
