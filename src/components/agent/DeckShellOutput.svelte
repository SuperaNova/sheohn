<script lang="ts">
  import type { ShellLogEntry } from '../../lib/shell/registry';

  let { log, maxHeightPx }: { log: ShellLogEntry[]; maxHeightPx?: number } =
    $props();

  let listEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    void log.length;
    const el = listEl;
    if (el) el.scrollTop = el.scrollHeight;
  });
</script>

<div
  bind:this={listEl}
  role="log"
  aria-label="Shell output"
  style:max-height={maxHeightPx ? `${maxHeightPx}px` : undefined}
  class="deck-scroll flex max-h-40 flex-col gap-3 overflow-y-auto border-b border-[var(--color-console-line)] p-4 font-mono text-[13px] leading-relaxed"
>
  {#each log as entry, i (i)}
    <div class="flex flex-col gap-0.5">
      <p class="flex items-start gap-1.5">
        <span class="text-[var(--color-console-signal)]" aria-hidden="true"
          >›</span
        >
        <span class="break-all text-[var(--color-console-text)]"
          >{entry.command}</span
        >
      </p>
      {#each entry.lines as line, j (j)}
        <p
          class="pl-4 break-words whitespace-pre-wrap {entry.error
            ? 'text-red-400'
            : 'text-[var(--color-console-text-dim)]'}"
        >
          {line}
        </p>
      {/each}
    </div>
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
