<script lang="ts">
  import { onMount } from 'svelte';
  import type { BootInfo } from '../../lib/boot-info';
  import { buildDeckBootLines } from '../../lib/dmesg';

  // Plays once per session on first deck open (gated in CommandDeck).
  // bootInfo arrives as a prop: boot-data.ts pulls in node:child_process, so never import it here.
  let { bootInfo, onComplete }: { bootInfo: BootInfo; onComplete: () => void } =
    $props();

  const lines = $derived.by(() => buildDeckBootLines(bootInfo));

  let lineCount = $state(0);
  let logEl = $state<HTMLElement | null>(null);
  let finished = false;

  $effect(() => {
    void lineCount;
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  });

  function finish() {
    if (finished) return;
    finished = true;
    onComplete();
  }

  // Any key/click reveals all remaining lines.
  function skip() {
    if (finished) return;
    lineCount = lines.length;
    finish();
  }

  onMount(() => {
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (reduceMotion) {
      // Reduced motion: show the full log statically, held long enough to read;
      // finishing synchronously would unmount before first paint.
      lineCount = lines.length;
      const t = setTimeout(finish, 1500);
      return () => clearTimeout(t);
    }

    const id = setInterval(() => {
      lineCount += 1;
      if (lineCount >= lines.length) {
        clearInterval(id);
        // Brief pause so the last line is legible.
        setTimeout(finish, 200);
      }
    }, 140);

    return () => clearInterval(id);
  });

  function handleKeydown(e: KeyboardEvent) {
    // Swallow the keystroke so it doesn't reach the focused command input.
    e.preventDefault();
    skip();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
  role="log"
  aria-label="Boot sequence"
  aria-live="polite"
  bind:this={logEl}
  onclick={skip}
  class="deck-scroll flex max-h-40 flex-col gap-1 overflow-y-auto border-b border-[var(--color-console-line)] p-4 font-mono text-[13px] leading-relaxed text-[var(--color-console-text)]"
>
  {#each lines.slice(0, lineCount) as line (line.ts)}
    <p>
      <span class="whitespace-pre text-[var(--color-console-signal)]"
        >{line.ts}</span
      >
      {#if line.tag}
        <span class="text-[var(--color-console-warn)]">{line.tag}:</span>
      {/if}
      {line.text}
    </p>
  {/each}
</div>

<style>
  .deck-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(74, 222, 128, 0.35) transparent;
  }
  .deck-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .deck-scroll::-webkit-scrollbar-thumb {
    background: rgba(74, 222, 128, 0.3);
    border-radius: 9999px;
  }
  .deck-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(74, 222, 128, 0.5);
  }
</style>
