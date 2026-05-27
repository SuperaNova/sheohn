<script lang="ts">
  import { inview } from '../lib/actions/inview';
  import { fade } from 'svelte/transition';
  import { activeFocus, overlayActive, clearFocus } from '../store';

  export type ProjectData = {
    slug: string;
    title: string;
    category: string;
    summary: string;
    stack: string[];
    status: string;
    image?: string;
    featured?: boolean;
  };

  export let projects: ProjectData[];
  export let title = 'Selected Work';
  export let subtitle = 'Featured Project';

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && $overlayActive) {
      clearFocus();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<section
  id="projects"
  class="content-wrap section-space relative z-[50] flex flex-col py-24 projects-section"
  use:inview={{ once: true, amount: 0.1 }}
>
  {#if $overlayActive}
    <button
      type="button"
      aria-label="Close project overlay"
      transition:fade={{ duration: 400 }}
      class="fixed inset-0 z-[45] cursor-pointer bg-black/80 backdrop-blur-sm w-full h-full border-none"
      on:click={clearFocus}
    ></button>
  {/if}

  <div class="projects-container relative z-[50]">
    <div
      class="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end"
    >
      <div>
        <h2
          class="font-display text-4xl text-[var(--color-on-surface)] sm:text-5xl"
        >
          {title}
        </h2>
        <span
          class="mt-3 block text-sm font-medium tracking-[0.2em] text-[var(--color-on-surface-muted)] uppercase"
        >
          {subtitle}
        </span>
      </div>

      <a
        href="/projects"
        class="group flex items-center gap-2 text-sm font-semibold tracking-wide text-[var(--color-tertiary)] transition hover:text-[var(--color-on-surface)]"
      >
        View All Projects
        <span class="transition-transform group-hover:translate-x-1">→</span>
      </a>
    </div>

    <div class="grid grid-cols-1 gap-12">
      {#each projects as project, i (project.slug)}
        {@const isMatch = $activeFocus
          ? project.stack.some((s) =>
              s.toLowerCase().includes($activeFocus!.toLowerCase()),
            ) ||
            project.title.toLowerCase().includes($activeFocus!.toLowerCase()) ||
            project.category.toLowerCase().includes($activeFocus!.toLowerCase())
          : false}
        {@const isFocused = $overlayActive && isMatch}
        {@const isDimmed = $overlayActive && !isMatch}

        <article
          style:transition-delay="{$overlayActive ? 0 : i * 100}ms"
          class="project-card group flex flex-col gap-8 transition-all duration-500 ease-out md:flex-row
            {isFocused
            ? 'relative z-[60] scale-[1.02]'
            : isDimmed
              ? 'pointer-events-none relative z-30 opacity-30 blur-[4px] scale-[0.95]'
              : 'relative z-10'}"
        >
          <!-- Image Container -->
          <a
            href={`/projects/${project.slug}`}
            aria-label={`View case study: ${project.title}`}
            class="group/image relative isolate block aspect-video w-full overflow-hidden rounded-2xl bg-[var(--color-surface-container)] md:aspect-[4/3] md:w-3/5"
          >
            {#if project.image}
              <!-- 
                TODO (Performance): These images are currently loading as raw background images.
                When replacing temporary images with real ones, either compress them to webp/avif,
                or use an optimized <img loading="lazy" /> element instead of a background image
                to drastically improve initial page load times on slow connections.
              -->
              <div
                class="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover/image:scale-105"
                style="background-image: url({project.image})"
              ></div>
            {:else}
              <div
                class="absolute inset-0 flex items-center justify-center text-sm tracking-widest text-[var(--color-on-surface-muted)] uppercase"
              >
                [ Demo Asset Missing ]
              </div>
            {/if}
            <div
              class="absolute inset-0 z-10 bg-black/5 opacity-0 transition-opacity duration-300 group-hover/image:opacity-100"
            ></div>
          </a>

          <!-- Text Content -->
          <div class="flex w-full flex-col justify-center py-4 md:w-2/5">
            <div class="mb-4 flex flex-wrap items-center gap-3">
              <span
                class="rounded-md bg-[color-mix(in_srgb,var(--color-tertiary-container)_28%,transparent)] px-2.5 py-1 text-[11px] font-bold tracking-wider text-[var(--color-tertiary)] uppercase"
              >
                {project.status}
              </span>
              <span
                class="text-xs font-medium tracking-[0.16em] text-[var(--color-on-surface-muted)] uppercase"
              >
                {project.category}
              </span>
            </div>

            <h3
              class="font-display mb-4 text-3xl font-semibold text-[var(--color-on-surface)]"
            >
              {project.title}
            </h3>
            <p
              class="text-base leading-relaxed text-[var(--color-on-surface-muted)]"
            >
              {project.summary}
            </p>

            <div class="mt-8 flex flex-wrap gap-2">
              {#each project.stack as tool (`${project.title}-${tool}`)}
                <li
                  class="list-none rounded bg-[var(--color-surface-container)] px-2.5 py-1.5 text-xs font-medium tracking-wide text-[var(--color-on-surface-muted)]"
                >
                  {tool}
                </li>
              {/each}
            </div>

            <a
              class="mt-8 inline-flex items-center gap-2 self-start rounded-lg bg-[var(--color-surface-container)] px-5 py-2.5 text-sm font-semibold tracking-wide text-[var(--color-on-surface)] transition hover:bg-[var(--color-tertiary)] hover:text-black"
              href={`/projects/${project.slug}`}
            >
              Read Case Study
            </a>
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>

<style>
  .projects-container {
    opacity: 0;
    transform: translateY(18px);
    transition:
      opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
  }

  :global(.projects-section.in-view) .projects-container {
    opacity: 1;
    transform: translateY(0);
  }
</style>
