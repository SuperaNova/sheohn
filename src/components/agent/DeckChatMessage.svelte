<script lang="ts">
  import type { UIMessage } from 'ai';
  import DeckRichText from './DeckRichText.svelte';
  import type { RagFact, RagQueryResult } from '../../lib/rag';

  let { message }: { message: UIMessage } = $props();

  // Correlate this message's query_jared_memory tool output with footnote
  // markers on its final text part. Positional (sentence-level) citation
  // would require guessing which chunk backs which sentence in freeform LLM
  // text, so — per spec #03's locked design — all kept facts are attached
  // to the LAST text part instead, rendered as an appended footnote list.
  const ragFacts: RagFact[] = $derived.by(() => {
    if (!message.parts) return [];
    const part = message.parts.find(
      (p) =>
        p.type === 'tool-query_jared_memory' &&
        (p as { state?: string }).state === 'output-available',
    );
    if (!part) return [];
    const output = (part as { output?: RagQueryResult }).output;
    return output?.facts ?? [];
  });

  const lastTextIndex = $derived.by(() => {
    if (!message.parts) return -1;
    let idx = -1;
    message.parts.forEach((p, i) => {
      if (p.type === 'text') idx = i;
    });
    return idx;
  });
</script>

<div class="flex flex-col gap-1">
  <span
    class="text-[10px] tracking-[0.18em] uppercase {message.role === 'user'
      ? 'text-[var(--color-console-signal)]/70'
      : 'text-[var(--color-console-text-dim)]'}"
  >
    {message.role === 'user' ? 'guest' : 'system'}
  </span>
  <div class="break-words text-[var(--color-console-text)]">
    {#if message.parts}
      {#each message.parts as p, i (i)}
        {#if p.type === 'text'}
          <DeckRichText
            text={(p as { type: 'text'; text: string }).text}
            facts={i === lastTextIndex ? ragFacts : []}
          />
        {:else if typeof p.type === 'string' && (p.type.startsWith('tool-') || p.type === 'dynamic-tool')}
          {@const part = p as {
            type: string;
            toolName?: string;
            input?: unknown;
          }}
          {@const toolName = part.toolName ?? part.type.replace(/^tool-/, '')}
          <span
            class="mt-1 block font-mono text-[11px] break-all text-[var(--color-console-signal)]/80"
          >
            › {toolName}({JSON.stringify(part.input)})
          </span>
        {/if}
      {/each}
    {:else}
      <DeckRichText text={(message as { content?: string }).content || ''} />
    {/if}
  </div>
</div>
