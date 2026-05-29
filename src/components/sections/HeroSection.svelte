<script lang="ts">
  import { Spring } from 'svelte/motion';
  import { inview } from '../../lib/actions/inview';
  import { scrollState } from '../../store';
  import DecoderText from '../ui/DecoderText.svelte';
  import { personalInfo } from '../../data/personalInfo';

  const parallaxY = new Spring(0, {
    stiffness: 0.11,
    damping: 0.28,
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
  class="content-wrap section-space relative flex min-h-[100svh] scroll-mt-24 items-center pt-24 hero-section"
  use:inview={{ once: true, amount: 0.5 }}
>
  <div
    class="site-grid pointer-events-none absolute inset-0 z-0 opacity-10"
  ></div>

  <div
    style:transform="translateY({parallaxY.current}px)"
    class="grid w-full items-end gap-12 lg:grid-cols-[1.2fr_0.8fr]"
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
        class="hero-item font-display text-5xl leading-[1.04] text-[var(--color-on-surface)] sm:text-[56px] md:text-6xl"
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
        <div class="relative flex h-3 w-3 items-center justify-center">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"
          ></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"
          ></span>
        </div>
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

      <div style:transition-delay="600ms" class="hero-item mt-10">
        <a
          href="#contact"
          class="inline-flex rounded-lg bg-[radial-gradient(circle_at_top_left,var(--color-primary-container),var(--color-primary))] px-6 py-3 text-sm font-semibold tracking-wide text-slate-100 shadow-[0_18px_34px_rgba(28,28,25,0.22)] transition-transform hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.985]"
        >
          Initiate Strategic Engagement
        </a>
      </div>
    </div>

    <aside
      style:transition-delay="720ms"
      class="hero-item group relative rounded-2xl border border-[var(--color-surface-container-highest)] bg-[color-mix(in_srgb,var(--color-surface-container-high)_50%,transparent)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-outline-variant)] hover:shadow-[4px_4px_0_0_var(--color-surface-container-highest)] dark:hover:shadow-[4px_4px_0_0_var(--color-primary-container)]"
    >
      <p
        class="text-xs tracking-[0.16em] text-[var(--color-tertiary)] uppercase"
      >
        Strategic Note
      </p>
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
