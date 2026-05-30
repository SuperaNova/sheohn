<script lang="ts">
  import { Spring } from 'svelte/motion';
  import { inview } from '../../lib/actions/inview';
  import { magnetic } from '../../lib/actions/magnetic';
  import {
    scrollState,
    commandDeckOpen,
    dispatchAgentQuery,
  } from '../../store';
  import DecoderText from '../ui/DecoderText.svelte';
  import { personalInfo } from '../../data/personalInfo';

  const parallaxY = new Spring(0, {
    stiffness: 0.11,
    damping: 0.28,
  });

  // First-move choreography: each chip sends a real query to the agent, which
  // then physically drives the page (pan / spotlight / open case study).
  const starters = [
    {
      label: 'show me what he built',
      q: 'What has Jared built? Show me his projects.',
    },
    {
      label: 'open the rust interpreter',
      q: 'Open the Lexicon Rust interpreter case study.',
    },
    { label: "what's his stack?", q: 'What is his tech stack?' },
    { label: 'is he available?', q: 'Is Jared available for opportunities?' },
  ];

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

  $effect(() =>
    scrollState.subscribe(({ scrollY, scrollHeight, innerHeight }) => {
      if (scrollHeight > innerHeight && innerHeight > 0) {
        const scrollYProgress = scrollY / (scrollHeight - innerHeight);
        parallaxY.target = scrollYProgress * -40;
      } else {
        parallaxY.target = 0;
      }
    }),
  );
</script>

<section
  id="home"
  class="content-wrap relative flex min-h-[100svh] scroll-mt-24 items-center py-20 hero-section"
  use:inview={{ once: true, amount: 0.2 }}
>
  <div
    class="site-grid pointer-events-none absolute inset-0 z-0 opacity-10"
  ></div>

  <div
    style:transform="translateY({parallaxY.current}px)"
    class="grid w-full items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]"
  >
    <div>
      <p
        style:transition-delay="0ms"
        class="hero-item mb-5 text-xs tracking-[0.24em] text-[var(--color-on-surface-muted)] uppercase"
      >
        <DecoderText text={personalInfo.title} delay={1800} />
      </p>

      <h1
        style:transition-delay="120ms"
        class="hero-item font-display text-6xl leading-[0.95] text-[var(--color-on-surface)] sm:text-7xl lg:text-[5rem]"
      >
        {personalInfo.name}
      </h1>

      <p
        style:transition-delay="240ms"
        class="hero-item mt-6 font-mono text-lg tracking-tight text-[var(--color-on-surface)] md:text-xl"
      >
        <DecoderText text={personalInfo.education} delay={2400} />
      </p>

      <div
        style:transition-delay="360ms"
        class="hero-item mt-6 flex items-center gap-3"
      >
        <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
        <span
          class="text-sm font-medium tracking-wide text-[var(--color-on-surface)]"
        >
          Available for Opportunities
        </span>
      </div>

      <p
        style:transition-delay="480ms"
        class="hero-item mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-on-surface-muted)] md:text-lg"
      >
        {personalInfo.bio}
      </p>

      <div
        style:transition-delay="600ms"
        class="hero-item mt-10 flex flex-wrap items-center gap-4"
      >
        <button
          type="button"
          onclick={openDeck}
          use:magnetic={{ strength: 0.4, max: 12 }}
          class="group inline-flex items-center gap-2 rounded-lg bg-[radial-gradient(circle_at_top_left,var(--color-primary-container),var(--color-primary))] px-6 py-3 text-sm font-semibold tracking-wide text-slate-100 shadow-[0_18px_34px_rgba(28,28,25,0.22)] transition-[box-shadow,transform] duration-300 ease-out hover:shadow-[0_22px_46px_rgba(28,28,25,0.32)]"
        >
          <span aria-hidden="true" class="font-mono text-emerald-300">›</span>
          Ask the system
          <kbd
            class="ml-1 hidden rounded border border-white/20 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 sm:inline"
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
        style:transition-delay="680ms"
        class="hero-item mt-6 flex flex-wrap gap-2 font-mono text-xs"
      >
        {#each starters as s (s.label)}
          <li>
            <button
              type="button"
              onclick={() => dispatchAgentQuery(s.q)}
              class="group inline-flex items-center gap-1.5 rounded-md border border-[var(--color-outline-variant)] bg-[color-mix(in_srgb,var(--color-surface-container)_60%,transparent)] px-2.5 py-1.5 text-[var(--color-on-surface-muted)] transition-colors hover:border-[var(--color-tertiary)] hover:text-[var(--color-on-surface)]"
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

    <aside
      style:transition-delay="720ms"
      class="hero-item group relative rounded-2xl border border-[var(--color-surface-container-highest)] bg-[color-mix(in_srgb,var(--color-surface-container-high)_50%,transparent)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-outline-variant)] hover:shadow-[4px_4px_0_0_var(--color-surface-container-highest)] dark:hover:shadow-[4px_4px_0_0_var(--color-primary-container)]"
    >
      <p class="readout">Currently</p>
      <p
        class="mt-4 text-sm leading-relaxed text-[var(--color-on-surface-muted)]"
      >
        {personalInfo.strategicNote}
      </p>
    </aside>
  </div>
</section>

<style>
  .hero-item {
    opacity: 0;
    transform: translateY(18px);
    transition:
      opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }

  :global(.hero-section.in-view) .hero-item {
    opacity: 1;
    transform: translateY(0);
  }
</style>
