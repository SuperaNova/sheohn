<script lang="ts">
  import { inview } from '../../lib/actions/inview';
  import { activeFocus, overlayActive } from '../../store';

  export type ProjectData = {
    slug: string;
    title: string;
    category: string;
    summary: string;
    stack: string[];
    status: string;
    role?: string;
    timeline?: string;
  };

  interface Props {
    projects: ProjectData[];
    title?: string;
    subtitle?: string;
  }

  let {
    projects,
    title = 'Selected Work',
    subtitle = 'ls ~/work',
  }: Props = $props();

  // "Crucible - Autonomous Sprite Synthesis Pipeline" -> "Crucible"
  const shortName = (t: string) => t.split(/\s[—–-]\s/)[0];
  // Compact, lowercased tech column: "python · gemini · flux"
  const stackLine = (p: ProjectData) =>
    p.stack
      .slice(0, 3)
      .map((s) => s.toLowerCase())
      .join(' · ');

  // The agent's trigger_ui_state sets activeFocus; dim non-matching rows so the
  // relevant module is emphasised when a tech is called out.
  function matches(p: ProjectData, focus: string) {
    const f = focus.toLowerCase();
    return (
      p.title.toLowerCase().includes(f) ||
      p.category.toLowerCase().includes(f) ||
      p.stack.some((s) => s.toLowerCase().includes(f))
    );
  }
</script>

<section
  id="projects"
  class="content-wrap section-space relative z-10 work-manifest"
  use:inview={{ once: true, amount: 0.15 }}
>
  <div class="manifest-inner">
    <div class="mb-8 flex items-end justify-between gap-6">
      <div>
        <h2
          class="font-display text-4xl text-[var(--color-on-surface)] sm:text-5xl"
        >
          {title}
        </h2>
        <span class="readout mt-3">{subtitle}</span>
      </div>
      <a
        href="/projects"
        class="group inline-flex shrink-0 items-center gap-2 font-mono text-sm text-[var(--color-tertiary)] transition hover:text-[var(--color-on-surface)]"
      >
        view all
        <span class="transition-transform group-hover:translate-x-1">→</span>
      </a>
    </div>

    <!-- Condensed terminal/watchlist table; rows expand on hover/focus -->
    <div
      class="overflow-hidden rounded-xl border border-[var(--color-outline-variant)] font-mono"
    >
      <div
        class="flex items-center gap-4 border-b border-[var(--color-outline-variant)] bg-[color-mix(in_srgb,var(--color-surface-container)_45%,transparent)] px-4 py-2.5 text-[10px] tracking-[0.18em] text-[var(--color-on-surface-muted)] uppercase md:px-6"
      >
        <span class="w-6">#</span>
        <span class="w-28 shrink-0 md:w-32">name</span>
        <span class="hidden w-56 shrink-0 md:block">domain</span>
        <span class="hidden flex-1 lg:block">stack</span>
        <span class="ml-auto">status</span>
        <span class="w-4" aria-hidden="true"></span>
      </div>

      {#each projects as project, i (project.slug)}
        {@const dim =
          $overlayActive && $activeFocus && !matches(project, $activeFocus)}
        <a
          href={`/projects/${project.slug}`}
          aria-label={`View case study: ${project.title}`}
          class="manifest-row group block border-b border-[var(--color-outline-variant)] px-4 transition-all duration-300 last:border-b-0 md:px-6
            {dim ? 'opacity-30' : ''}"
        >
          <div class="flex items-center gap-4 py-3.5 text-sm">
            <span class="w-6 tabular-nums text-[var(--color-on-surface-muted)]">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span
              class="w-28 shrink-0 truncate font-semibold text-[var(--color-on-surface)] transition-colors group-hover:text-[var(--color-tertiary)] md:w-32"
            >
              {shortName(project.title)}
            </span>
            <span
              class="hidden w-56 shrink-0 truncate text-[var(--color-on-surface-muted)] md:block"
            >
              {project.category.toLowerCase()}
            </span>
            <span
              class="hidden flex-1 truncate text-[var(--color-on-surface-muted)] lg:block"
            >
              {stackLine(project)}
            </span>
            <span
              class="ml-auto shrink-0 text-[11px] tracking-wider text-[var(--color-tertiary)] uppercase"
            >
              {project.status}
            </span>
            <span
              aria-hidden="true"
              class="w-4 shrink-0 text-[var(--color-tertiary)] transition-transform duration-300 group-hover:translate-x-1"
              >→</span
            >
          </div>

          <!-- reveal on hover / keyboard focus; always-open on touch (no hover) -->
          <div
            class="manifest-detail grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]"
          >
            <div class="overflow-hidden">
              <div
                class="manifest-detail-body pb-5 pl-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 md:pl-[3rem]"
              >
                <p
                  class="max-w-2xl text-sm leading-relaxed text-[var(--color-on-surface)] md:text-[15px]"
                >
                  {project.summary}
                </p>
                <div
                  class="mt-3 flex items-center gap-4 text-[11px] tracking-wide text-[var(--color-on-surface-muted)]"
                >
                  {#each [project.role, project.timeline].filter(Boolean) as meta, idx (meta)}
                    {#if idx > 0}<span class="opacity-40">·</span>{/if}
                    <span>{meta}</span>
                  {/each}
                  <span class="opacity-40">·</span>
                  <span class="text-[var(--color-tertiary)]"
                    >read case study →</span
                  >
                </div>
              </div>
            </div>
          </div>
        </a>
      {/each}
    </div>
  </div>
</section>

<style>
  @media (prefers-reduced-motion: no-preference) {
    :global(html.js-reveal) .manifest-inner {
      opacity: 0;
      transform: translateY(18px);
      transition:
        opacity 0.65s cubic-bezier(0.22, 1, 0.36, 1),
        transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
    }
  }

  :global(.work-manifest.in-view) .manifest-inner {
    opacity: 1;
    transform: translateY(0);
  }

  .manifest-row:hover,
  .manifest-row:focus-within {
    background: color-mix(
      in srgb,
      var(--color-surface-container) 45%,
      transparent
    );
  }

  /* Touch devices can't hover, and tapping a row navigates straight to the case
     study — so the hover/focus-only detail would never be seen. Reveal it inline
     there instead; the summary and metadata are core content, not decoration. */
  @media (hover: none) {
    .manifest-detail {
      grid-template-rows: 1fr;
    }
    .manifest-detail-body {
      opacity: 1;
    }
  }
</style>
