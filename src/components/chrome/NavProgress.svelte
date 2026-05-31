<script lang="ts">
  import { onMount } from 'svelte';

  // Thin top progress bar shown while Astro's ClientRouter is fetching the
  // next page. On throttled connections the swap can take a while, so this
  // gives immediate feedback that the tap registered and navigation is
  // in flight — otherwise it just feels broken.
  let visible = $state(false);
  let progress = $state(0);
  let creep = 0;
  let hideTimer = 0;

  onMount(() => {
    const start = () => {
      clearInterval(creep);
      clearTimeout(hideTimer);
      visible = true;
      progress = 0.08;
      // Ease toward 90% while we wait — never reaches 100 until done.
      creep = window.setInterval(() => {
        progress = Math.min(progress + (1 - progress) * 0.14, 0.9);
      }, 180);
    };

    const done = () => {
      clearInterval(creep);
      progress = 1;
      hideTimer = window.setTimeout(() => {
        visible = false;
        progress = 0;
      }, 280);
    };

    // before-preparation: navigation started (old page). page-load: arrived.
    document.addEventListener('astro:before-preparation', start);
    document.addEventListener('astro:page-load', done);

    return () => {
      clearInterval(creep);
      clearTimeout(hideTimer);
      document.removeEventListener('astro:before-preparation', start);
      document.removeEventListener('astro:page-load', done);
    };
  });
</script>

{#if visible}
  <div
    class="pointer-events-none fixed inset-x-0 top-0 z-[1000] h-[3px]"
    role="progressbar"
    aria-label="Page loading"
  >
    <div
      class="h-full bg-[var(--color-tertiary)] shadow-[0_0_10px_var(--color-tertiary)] transition-[width] duration-200 ease-out"
      style:width="{progress * 100}%"
    ></div>
  </div>
{/if}
