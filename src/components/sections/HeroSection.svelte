<script lang="ts">
  import { onMount } from 'svelte';
  import { Spring } from 'svelte/motion';
  import { get } from 'svelte/store';
  import { inview } from '../../lib/actions/inview';
  import { magnetic } from '../../lib/actions/magnetic';
  import { prefersReducedMotion } from '../../lib/motion';
  import {
    isEnteringDark,
    shouldPlayDarkEntrance,
  } from '../../lib/theme-transition';
  import {
    scrollState,
    commandDeckOpen,
    dispatchAgentQuery,
    theme,
    heroInView,
  } from '../../store';
  import { personalInfo } from '../../data/personalInfo';
  import { starters } from '../../data/starters';
  import HeroScene from './HeroScene.svelte';

  // boot-data.ts pulls in node:child_process, so index.astro computes the
  // commit SHA at build time and passes only the string down.
  interface Props {
    bootCommitSha?: string;
  }
  let { bootCommitSha = 'dev' }: Props = $props();

  // Cebu City's public coordinates, for the dark hero's left rail.
  const CEBU_COORDS = '10.3157°N 123.8854°E';

  // Split the name around the middle initial so dark mode can italicize it;
  // falls back to the plain string if the shape doesn't match.
  const nameParts = (() => {
    const m = personalInfo.name.match(/^(.*)\s(\p{Lu}\.)\s(.*)$/u);
    return m ? { before: m[1], accent: m[2], after: m[3] } : null;
  })();

  // Kicker suffix folds away with no dangling separator when the flag is off.
  const kickerSuffix = personalInfo.availableForOpportunities
    ? ' — available for opportunities'
    : '';

  // Click/keyboard-triggered copy of the full name, with a brief hint.
  let copied = $state(false);
  let copyStamp = $state(0);

  async function copyName() {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(personalInfo.name);
      copied = true;
      copyStamp = Date.now();
    } catch {
      // Denied or unsupported context — no crash, no hint.
    }
  }

  function onNameKeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    copyName();
  }

  $effect(() => {
    if (!copied) return;
    void copyStamp;
    const timer = setTimeout(() => {
      copied = false;
    }, 1600);
    return () => clearTimeout(timer);
  });

  const parallaxY = new Spring(0, {
    stiffness: 0.11,
    damping: 0.28,
  });

  // The "power on" chip is pointless once the site is already dark.
  const visibleStarters = $derived(
    starters.filter((s) => !s.hideWhenDark || $theme !== 'dark'),
  );

  // Tells the deck whether at least half the hero is on screen; false again
  // as soon as this component (home page) unmounts.
  let sectionEl = $state<HTMLElement | null>(null);
  $effect(() => {
    if (!sectionEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        heroInView.set((entry?.intersectionRatio ?? 0) >= 0.5);
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(sectionEl);
    return () => {
      observer.disconnect();
      heroInView.set(false);
    };
  });

  function openDeck() {
    commandDeckOpen.set(true);
  }

  // Show the platform-correct shortcut. SSR-safe default (non-mac); corrected
  // client-side so it never visually locks the UI to macOS.
  let shortcut = $state('Ctrl K');
  $effect(() => {
    const mac = /Mac|iPhone|iPad/.test(
      navigator.platform || navigator.userAgent,
    );
    shortcut = mac ? '⌘K' : 'Ctrl K';
  });

  $effect(() => {
    if (prefersReducedMotion()) {
      parallaxY.target = 0;
      return;
    }
    return scrollState.subscribe(({ scrollY, scrollHeight, innerHeight }) => {
      if (scrollHeight > innerHeight && innerHeight > 0) {
        const scrollYProgress = scrollY / (scrollHeight - innerHeight);
        parallaxY.target = scrollYProgress * -40;
      } else {
        parallaxY.target = 0;
      }
    });
  });

  // Power-on choreography: only when toggling light → dark, never on the
  // initial value the store already holds (see the entrance effect below
  // for that case), never under reduced motion.
  let powering = $state(false);
  let prevTheme: 'light' | 'dark' = get(theme);
  $effect(() => {
    const current = $theme;
    const entering = isEnteringDark(prevTheme, current);
    prevTheme = current;
    if (!entering || prefersReducedMotion()) return;
    powering = true;
    const timer = setTimeout(() => {
      powering = false;
    }, 2000);
    return () => clearTimeout(timer);
  });

  // Quiet dark-landing entrance: visitors who land already in dark
  // (persisted theme or ?theme=dark) get a short once-per-session grid
  // draw-in + glow bloom — no flash, no whoosh.
  let entrance = $state(false);
  onMount(() => {
    const played = !!sessionStorage.getItem('dark-entrance-played');
    if (
      !shouldPlayDarkEntrance({
        theme: get(theme),
        alreadyPlayed: played,
        reducedMotion: prefersReducedMotion(),
      })
    ) {
      return;
    }
    sessionStorage.setItem('dark-entrance-played', 'true');
    entrance = true;
    const timer = setTimeout(() => {
      entrance = false;
    }, 1200);
    return () => clearTimeout(timer);
  });
</script>

<!-- Both themes share the poster layout (copy column hugging the left
     inset); the scene, plate frame, and rails remain dark-only. -->
<section
  id="home"
  bind:this={sectionEl}
  class="hero-section relative isolate flex min-h-[100svh] scroll-mt-24 items-center py-20"
  class:hero-powering={powering}
  use:inview={{ once: true, amount: 0.2 }}
>
  <div
    class="site-grid hero-bg-grid pointer-events-none absolute inset-0 z-0 mx-auto w-full max-w-[74rem] opacity-10"
  ></div>

  <HeroScene {powering} {entrance} />

  <div class="hero-flash" aria-hidden="true"></div>

  <!-- Specimen-plate frame + metadata rails: dark-only, hidden below ~900px,
       decorative (aria-hidden). -->
  <div class="hero-frame" aria-hidden="true">
    <span class="hero-rail hero-rail-l">
      FIELD RECORD · CEBU CITY · {CEBU_COORDS}
    </span>
    <span class="hero-rail hero-rail-r">
      SHN-01 · BUILD {bootCommitSha} · REPLIES 1–2 DAYS
    </span>
  </div>

  <div class="hero-content flex w-full self-stretch">
    <div
      style:transform="translateY({parallaxY.current}px)"
      class="flex w-full"
    >
      <div class="flex w-full flex-col">
        <p
          style:transition-delay="0ms"
          style:animation-delay="350ms"
          class="hero-item mb-5 font-mono text-xs tracking-[0.22em] text-[var(--color-tertiary)] uppercase"
        >
          › {personalInfo.title}{kickerSuffix}
        </p>

        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <!-- kept as a real h1 (name-from-content, unchanged); click-to-copy is
             a bonus affordance described via aria-describedby, not aria-label,
             so the heading's accessible name stays the actual name. -->
        <h1
          style:transition-delay="120ms"
          style:animation-delay="470ms"
          class="hero-item hero-name font-display relative cursor-pointer leading-[0.95] text-balance text-[var(--color-on-surface)]"
          tabindex="0"
          aria-describedby="hero-name-copy-hint"
          onclick={copyName}
          onkeydown={onNameKeydown}
        >
          <span class="hero-name-hint" class:visible={copied} aria-hidden="true"
            >copied</span
          >
          {#if nameParts}
            {nameParts.before}<br />
            <em>{nameParts.accent}</em>
            {nameParts.after}
          {:else}
            {personalInfo.name}
          {/if}
        </h1>
        <span id="hero-name-copy-hint" class="sr-only"
          >Copy name to clipboard</span
        >

        <p
          style:transition-delay="240ms"
          style:animation-delay="590ms"
          class="hero-item hero-edu mt-6 font-mono"
        >
          {personalInfo.heroMeta}
        </p>

        <p
          style:transition-delay="360ms"
          style:animation-delay="710ms"
          class="hero-item hero-bio mt-4 text-pretty text-[var(--color-on-surface-muted)]"
        >
          {personalInfo.bio}
        </p>

        <div
          style:transition-delay="480ms"
          style:animation-delay="830ms"
          class="hero-item mt-auto flex flex-wrap items-center gap-4 pt-10"
        >
          <button
            type="button"
            onclick={openDeck}
            use:magnetic={{ strength: 0.4, max: 12 }}
            class="group inline-flex items-center gap-2 rounded-lg bg-[radial-gradient(circle_at_top_left,var(--color-cta-from),var(--color-cta-to))] px-6 py-3 text-sm font-semibold tracking-wide text-[var(--color-on-cta)] shadow-[0_18px_34px_rgba(28,28,25,0.22)] transition-[box-shadow,transform] duration-300 ease-out hover:shadow-[0_22px_46px_rgba(28,28,25,0.32)]"
          >
            <span
              aria-hidden="true"
              class="font-mono text-[var(--color-on-cta-accent)]">›</span
            >
            Ask the system
            <kbd
              class="ml-1 hidden rounded border border-white/20 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-on-cta)]/70 sm:inline"
              >{shortcut}</kbd
            >
          </button>
          <a
            href="#contact"
            class="text-sm font-semibold tracking-wide text-[var(--color-on-surface-muted)] underline-offset-4 transition hover:text-[var(--color-on-surface)] hover:underline"
          >
            or get in touch →
          </a>
        </div>

        <!-- Starter commands — first click drives the page via the agent. -->
        <ul
          style:transition-delay="560ms"
          style:animation-delay="950ms"
          class="hero-item mt-6 flex flex-wrap gap-2 font-mono text-xs"
        >
          {#each visibleStarters as s (s.label)}
            <li>
              <button
                type="button"
                onclick={() => dispatchAgentQuery(s.q)}
                class="group inline-flex items-center gap-1.5 rounded-md border border-[var(--color-outline-variant)] bg-[color-mix(in_srgb,var(--color-surface-container)_60%,transparent)] px-2.5 py-1.5 text-[var(--color-on-surface-muted)] transition-colors hover:border-[var(--color-tertiary)] hover:text-[var(--color-on-surface)] pointer-coarse:min-h-[44px]"
              >
                <span
                  aria-hidden="true"
                  class="text-[var(--color-tertiary)] transition-transform group-hover:translate-x-0.5"
                  >›</span
                >
                {s.label}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </div>
</section>

<style>
  @media (prefers-reduced-motion: no-preference) {
    :global(html.js-reveal) .hero-item {
      opacity: 0;
      transform: translateY(18px);
      transition:
        opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
        transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
    }
  }

  :global(.hero-section.in-view) .hero-item {
    opacity: 1;
    transform: translateY(0);
  }

  /* Power-on choreography (toggling into dark, see HeroSection's `powering`
     state): a phosphor flash over the poster, then the same .hero-item
     elements re-rise staggered by their existing animation-delay. Both
     classes are applied via `class:` directives so Svelte keeps these rules. */
  .hero-flash {
    position: absolute;
    inset: 0;
    z-index: 5;
    opacity: 0;
    pointer-events: none;
    background: radial-gradient(
      circle at 88% 4%,
      color-mix(in srgb, var(--color-scene-glow) 90%, transparent),
      color-mix(in srgb, var(--color-scene-glow) 22%, transparent) 40%,
      transparent 70%
    );
  }

  @media (prefers-reduced-motion: no-preference) {
    .hero-section.hero-powering .hero-flash {
      animation: hero-flash-in 0.5s ease-out both;
    }

    .hero-section.hero-powering .hero-item {
      animation: hero-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
  }

  @keyframes hero-flash-in {
    0% {
      opacity: 0;
    }
    18% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @keyframes hero-rise {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
  }

  /* Poster layout — shared by both themes. Only the scene, plate frame,
     and rails below stay dark-only. */

  /* the light grid overlay fights the scene's perspective grid */
  :global(html.dark) .hero-bg-grid {
    display: none;
  }

  /* Copy column hugs the plate's left edge instead of a centered content
     column; the stretched column anchors the CTA row toward the bottom. */
  .hero-content {
    padding-inline: var(--scene-copy-inset-x);
    padding-top: var(--scene-copy-inset-top);
  }

  .hero-name em {
    font-style: italic;
    color: var(--color-tertiary);
  }

  /* the pale phosphor accent needs the dark scene behind it */
  :global(html.dark) .hero-name em {
    color: var(--color-on-cta-accent);
  }

  /* Transient copy-to-clipboard confirmation — absolutely positioned so it
     never shifts the heading's layout. */
  .hero-name-hint {
    position: absolute;
    right: 0;
    bottom: 100%;
    margin-bottom: 0.4rem;
    opacity: 0;
    translate: 0 4px;
    pointer-events: none;
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-console-signal);
    transition:
      opacity 0.2s ease,
      translate 0.2s ease;
  }

  .hero-name-hint.visible {
    opacity: 1;
    translate: 0 0;
  }

  /* poster typography */
  .hero-name {
    font-size: clamp(3.4rem, 8vw, 5.6rem);
  }

  /* the glow only reads against the dark scene */
  :global(html.dark) .hero-name {
    text-shadow: 0 0 44px
      color-mix(in srgb, var(--color-scene-glow) 50%, transparent);
  }

  .hero-edu {
    max-width: 40rem;
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    color: var(--color-on-surface-muted);
  }

  .hero-bio {
    max-width: 34rem;
    font-size: 1rem;
    line-height: 1.65;
  }

  /* Frame + rails: hidden by default, dark-only, hidden again below ~900px. */
  .hero-frame {
    display: none;
  }

  :global(html.dark) .hero-frame {
    display: block;
    position: absolute;
    inset: var(--scene-frame-inset);
    border: 1px solid
      color-mix(in srgb, var(--color-on-cta-accent) 40%, transparent);
    pointer-events: none;
  }

  :global(html.dark) .hero-frame::before,
  :global(html.dark) .hero-frame::after {
    content: '';
    position: absolute;
    left: -1px;
    right: -1px;
    height: 10px;
    background: repeating-linear-gradient(
      to right,
      color-mix(in srgb, var(--color-on-cta-accent) 55%, transparent) 0 1px,
      transparent 1px 28px
    );
  }

  :global(html.dark) .hero-frame::before {
    top: -1px;
  }

  :global(html.dark) .hero-frame::after {
    bottom: -1px;
    transform: scaleY(-1);
  }

  .hero-rail {
    display: none;
  }

  :global(html.dark) .hero-rail {
    display: block;
    position: absolute;
    top: 50%;
    translate: 0 -50%;
    writing-mode: vertical-rl;
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
    font-size: 0.62rem;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    white-space: nowrap;
    color: color-mix(in srgb, var(--color-on-surface-muted) 80%, transparent);
  }

  :global(html.dark) .hero-rail-l {
    left: -1.1rem;
    rotate: 180deg;
  }

  :global(html.dark) .hero-rail-r {
    right: -1.1rem;
  }

  @media (max-width: 899.98px) {
    :global(html.dark) .hero-frame {
      display: none;
    }
  }
</style>
