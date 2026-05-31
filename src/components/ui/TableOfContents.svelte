<script lang="ts">
  import { onMount } from 'svelte';

  type Heading = {
    depth: number;
    slug: string;
    text: string;
  };

  let { headings = [] }: { headings?: Heading[] } = $props();

  let activeId = $state('');
  const tocHeadings = $derived(
    headings.filter((h) => h.depth > 1 && h.depth <= 3),
  );

  onMount(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.slug))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activeId = entry.target.id;
          }
        });
      },
      {
        rootMargin: '-10% 0px -80% 0px',
        threshold: 1.0,
      },
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  });
</script>

{#if headings.length > 0}
  <nav class="pr-8 pb-12">
    <a
      href="/projects"
      class="group mb-12 inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-[var(--color-on-surface-muted)] uppercase transition-colors hover:text-[var(--color-on-surface)]"
    >
      <span class="transition-transform group-hover:-translate-x-1">←</span>
      Back
    </a>

    <ul
      class="flex flex-col gap-4 border-l border-[var(--color-outline-variant)]"
    >
      {#each tocHeadings as heading (heading.slug)}
        {@const isActive = activeId === heading.slug}
        <li class="relative {heading.depth === 3 ? 'ml-4' : ''}">
          {#if isActive}
            <div
              class="absolute top-1/2 -left-[5px] z-10 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--color-tertiary)]"
            ></div>
          {/if}

          <a
            href={`#${heading.slug}`}
            class="block pl-4 text-xs font-medium transition-colors {isActive
              ? 'text-[var(--color-on-surface)]'
              : 'text-[var(--color-on-surface-muted)] hover:text-[var(--color-on-surface)]'}"
          >
            {heading.text}
          </a>
        </li>
      {/each}
    </ul>
  </nav>
{/if}
