<script lang="ts">
  import type { UIMessage } from 'ai';
  import DeckRichText from './DeckRichText.svelte';

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
    <div class="flex flex-col gap-1">
      <span
        class="text-[10px] tracking-[0.18em] uppercase {m.role === 'user'
          ? 'text-[var(--color-console-signal)]/70'
          : 'text-[var(--color-console-text-dim)]'}"
      >
        {m.role === 'user' ? 'guest' : 'system'}
      </span>
      <div class="break-words text-[var(--color-console-text)]">
        {#if m.parts}
          {#each m.parts as p, i (i)}
            {#if p.type === 'text'}
              <DeckRichText text={(p as { type: 'text'; text: string }).text} />
            {:else if typeof p.type === 'string' && (p.type.startsWith('tool-') || p.type === 'dynamic-tool')}
              {@const part = p as {
                type: string;
                toolName?: string;
                input?: unknown;
              }}
              {@const toolName =
                part.toolName ?? part.type.replace(/^tool-/, '')}
              <span
                class="mt-1 block font-mono text-[11px] break-all text-[var(--color-console-signal)]/80"
              >
                › {toolName}({JSON.stringify(part.input)})
              </span>
            {/if}
          {/each}
        {:else}
          <DeckRichText text={(m as { content?: string }).content || ''} />
        {/if}
      </div>
    </div>
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
