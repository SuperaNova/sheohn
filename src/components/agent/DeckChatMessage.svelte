<script lang="ts">
  import type { UIMessage } from 'ai';
  import DeckRichText from './DeckRichText.svelte';

  let { message }: { message: UIMessage } = $props();
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
          <DeckRichText text={(p as { type: 'text'; text: string }).text} />
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
