<script lang="ts">
  import { onMount } from 'svelte';
  import type { BootInfo } from '../../lib/boot-info';

  // Plays once per browser session, the first time the command deck opens
  // (gated by CommandDeck.svelte via sessionStorage['deck-boot-played']).
  // `bootInfo` is computed at build time in Astro frontmatter — see
  // src/lib/boot-data.ts for why this component never imports that module
  // directly (it pulls in node:child_process).
  let { bootInfo, onComplete }: { bootInfo: BootInfo; onComplete: () => void } =
    $props();

  const lines = $derived.by(() => {
    const l = [
      '[ OK ] sheohn.os deck boot',
      `[ OK ] commit ${bootInfo.commitSha}`,
      `[ OK ] build ${bootInfo.buildTimestamp}`,
      `[ OK ] ${bootInfo.dependencyCount} dependencies loaded`,
    ];
    if (bootInfo.vectorCount !== undefined) {
      l.push(`[ OK ] ${bootInfo.vectorCount} vectors indexed`);
    }
    l.push('[ OK ] shell ready');
    return l;
  });

  let lineCount = $state(0);
  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    onComplete();
  }

  // Skippable on any key/click — instantly reveals every remaining line
  // rather than requiring one keypress per line.
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
      // Same end state, no motion: render the full log immediately — but
      // hold it on screen long enough to read before handing off. Calling
      // finish() synchronously here would unmount the component before a
      // frame ever painted, so reduced-motion users would never see the log
      // at all. A static hold isn't motion; any key/click still skips sooner.
      lineCount = lines.length;
      const t = setTimeout(finish, 1500);
      return () => clearTimeout(t);
    }

    const id = setInterval(() => {
      lineCount += 1;
      if (lineCount >= lines.length) {
        clearInterval(id);
        // Brief pause so the last line is legible before handing off —
        // mirrors Loader.svelte's finish() delay.
        setTimeout(finish, 200);
      }
    }, 140);

    return () => clearInterval(id);
  });

  function handleKeydown(e: KeyboardEvent) {
    // "Press any key to continue" — don't let the keystroke also land in
    // the (already-focused) command input behind this panel.
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
  onclick={skip}
  class="deck-scroll flex max-h-40 flex-col gap-1 overflow-y-auto border-b border-[var(--color-console-line)] p-4 font-mono text-[13px] leading-relaxed"
>
  {#each lines.slice(0, lineCount) as line (line)}
    <p class="text-[var(--color-console-signal)]">{line}</p>
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
