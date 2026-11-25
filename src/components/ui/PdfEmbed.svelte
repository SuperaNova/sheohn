<script lang="ts">
  import { fade } from 'svelte/transition';
  // The iframe mounts only after the visitor clicks Load document; a spinner shows until its load event.

  let {
    src,
    title,
    caption = '',
  }: { src: string; title: string; caption?: string } = $props();

  let requested = $state(false);
  let loaded = $state(false);
  // Mobile taps open a new tab with no preview, so surface the filename up front.
  const fileName = $derived(src.split('/').pop() || src);
</script>

<div
  class="my-8 overflow-hidden rounded-xl border border-[var(--color-outline-variant)] bg-[var(--color-surface)] shadow-sm"
>
  <!-- Desktop: poster until the visitor asks for the document, then the iframe viewer -->
  <div class="relative hidden h-[75vh] w-full md:block">
    {#if !requested}
      <div
        class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[var(--color-surface-container)] px-6 text-center"
      >
        <span
          class="font-mono text-xs tracking-wide text-[var(--color-on-surface-muted)]"
          >{caption}</span
        >
        <span
          class="font-mono text-[11px] tracking-wide text-[var(--color-on-surface-muted)]/70"
          >{fileName}</span
        >
        <button
          type="button"
          onclick={() => (requested = true)}
          class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-tertiary)] transition hover:text-[var(--color-on-surface)]"
        >
          Load document
        </button>
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          class="text-xs font-semibold text-[var(--color-tertiary)] hover:text-[var(--color-on-surface)] hover:underline"
        >
          Open in a new tab ↗
        </a>
      </div>
    {:else}
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
    {/if}
  </div>

  <!-- Mobile: link-only fallback (PDF iframes are unusable on iOS/Android) -->
  <div class="flex flex-col items-center gap-4 px-6 py-10 md:hidden">
    <span
      class="font-mono text-xs tracking-wide text-[var(--color-on-surface-muted)]"
      >{caption}</span
    >
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      class="inline-flex items-center gap-2 rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-5 py-3 text-sm font-semibold text-[var(--color-tertiary)] transition hover:text-[var(--color-on-surface)]"
    >
      Open document ↗
    </a>
    <span
      class="font-mono text-[11px] tracking-wide text-[var(--color-on-surface-muted)]/70"
      >opens {fileName} in a new tab</span
    >
  </div>

  <div
    class="hidden items-center justify-between bg-[var(--color-surface-container)] px-6 py-4 text-xs text-[var(--color-on-surface-muted)] md:flex"
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
