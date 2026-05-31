<script lang="ts">
  import { fade } from 'svelte/transition';
  // Lazy PDF embed. Rendered with `client:visible`, so the heavy <iframe> only
  // mounts when the section scrolls into view — opening the case study is
  // instant and navigating away never blocks on a PDF fetch. A spinner shows
  // until the document's load event fires, then the frame fades in.

  let {
    src,
    title,
    caption = '',
  }: { src: string; title: string; caption?: string } = $props();

  let loaded = $state(false);
</script>

<div
  class="my-8 overflow-hidden rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] shadow-sm"
>
  <div class="relative h-[75vh] w-full">
    {#if !loaded}
      <div
        class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--color-surface-container)] text-[var(--color-on-surface-muted)]"
        out:fade={{ duration: 200 }}
      >
        <span
          class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-outline-variant)] border-t-[var(--color-tertiary)]"
          aria-hidden="true"
        ></span>
        <span class="font-mono text-xs tracking-wide">loading document…</span>
      </div>
    {/if}
    <iframe
      {src}
      {title}
      onload={() => (loaded = true)}
      class="h-full w-full border-none transition-opacity duration-300"
      class:opacity-0={!loaded}
      class:opacity-100={loaded}
    ></iframe>
  </div>
  <div
    class="flex items-center justify-between bg-[var(--color-surface-container)] px-6 py-4 text-xs text-[var(--color-on-surface-muted)]"
  >
    <span>{caption}</span>
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      class="font-semibold text-[var(--color-tertiary)] hover:text-[var(--color-on-surface)] hover:underline"
    >
      Open in new tab ↗
    </a>
  </div>
</div>
