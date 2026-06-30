<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  // Zero-config image zoom: this single island scans the case-study article for
  // <img> elements (hero + MDX diagrams), marks them zoomable, and opens a
  // click-to-zoom overlay. No per-image markup needed, so it covers every
  // current and future case-study image automatically.

  let open = $state(false);
  let src = $state('');
  let alt = $state('');
  let bound: HTMLImageElement[] = [];

  function handleClick(e: Event) {
    e.preventDefault();
    const img = e.currentTarget as HTMLImageElement;
    src = img.currentSrc || img.src;
    alt = img.alt || '';
    open = true;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    open = false;
    document.body.style.overflow = '';
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) close();
  }

  function bind() {
    unbind();
    bound = [...document.querySelectorAll<HTMLImageElement>('article img')];
    for (const img of bound) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', handleClick);
    }
  }

  function unbind() {
    for (const img of bound) img.removeEventListener('click', handleClick);
    bound = [];
  }

  onMount(() => {
    bind();
    // Re-scan after every view-transition navigation (new case study swapped in).
    document.addEventListener('astro:page-load', bind);
  });

  onDestroy(() => {
    unbind();
    if (typeof document !== 'undefined') {
      document.removeEventListener('astro:page-load', bind);
      document.body.style.overflow = '';
    }
  });
</script>

<svelte:window onkeydown={onKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-[300] cursor-zoom-out overflow-auto bg-black/85 p-4 backdrop-blur-sm md:flex md:items-center md:justify-center md:overflow-hidden md:p-10"
    role="dialog"
    aria-modal="true"
    aria-label={alt || 'Image preview'}
    tabindex="-1"
    onclick={close}
    transition:fade={{ duration: 180 }}
  >
    <button
      type="button"
      aria-label="Close image preview"
      class="sticky top-0 right-0 z-10 mb-3 ml-auto flex rounded-full border border-white/20 bg-black/40 px-3 py-1.5 font-mono text-xs tracking-wide text-white/80 transition hover:bg-black/70 hover:text-white md:absolute md:top-4 md:right-4 md:mb-0 md:ml-0"
      onclick={close}
    >
      esc ✕
    </button>
    <img
      {src}
      {alt}
      class="w-full rounded-lg shadow-2xl md:max-h-full md:max-w-full md:w-auto md:object-contain"
      transition:scale={{ duration: 200, start: 0.94 }}
    />
  </div>
{/if}
