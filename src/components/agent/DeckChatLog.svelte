<script lang="ts">
  import type { UIMessage } from 'ai';
  import DeckChatMessage from './DeckChatMessage.svelte';

  let {
    messages,
    showTyping,
    maxHeightPx,
  }: { messages: UIMessage[]; showTyping: boolean; maxHeightPx: number } =
    $props();

  let listEl = $state<HTMLDivElement | null>(null);

  // Grows as tokens stream in, so the autoscroll effect keeps firing.
  const streamTick = $derived.by(() => {
    if (!messages.length) return 0;
    return messages.reduce((n, m) => {
      if (!m.parts)
        return n + ((m as { content?: string }).content?.length ?? 0);
      return (
        n +
        m.parts.reduce(
          (t, p) =>
            t + (p.type === 'text' ? (p as { text: string }).text.length : 0),
          0,
        )
      );
    }, 0);
  });

  $effect(() => {
    void streamTick;
    void messages.length;
    const el = listEl;
    if (el) el.scrollTop = el.scrollHeight;
  });
</script>

<div
  bind:this={listEl}
  role="log"
  aria-live="polite"
  aria-label="Agent conversation"
  style:max-height={maxHeightPx ? `${maxHeightPx}px` : undefined}
  class="deck-scroll flex max-h-72 flex-col gap-4 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed"
>
  {#each messages as m (m.id)}
    <DeckChatMessage message={m} />
  {/each}
  {#if showTyping}
    <div class="flex flex-col gap-1">
      <span
        class="text-[10px] tracking-[0.18em] text-[var(--color-console-text-dim)] uppercase"
        >system</span
      >
      <span
        class="mt-1 inline-block h-3.5 w-1.5 animate-pulse bg-[var(--color-console-signal)]"
      ></span>
    </div>
  {/if}
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
