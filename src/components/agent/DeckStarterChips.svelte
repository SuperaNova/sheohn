<script lang="ts">
  import type { Starter } from '../../data/starters';

  let {
    starters,
    starterIndex,
    showHint,
    onAsk,
  }: {
    starters: Starter[];
    starterIndex: number;
    showHint: boolean;
    onAsk: (q: string) => void;
  } = $props();
</script>

<div class="flex flex-wrap items-center gap-2">
  {#each starters as s, i (s.label)}
    <button
      type="button"
      onclick={() => onAsk(s.q)}
      aria-current={starterIndex === i ? 'true' : undefined}
      class="inline-flex items-center rounded-md border px-2.5 py-1 text-xs transition-colors pointer-coarse:min-h-[44px] {starterIndex ===
      i
        ? 'border-[var(--color-console-signal)] bg-[var(--color-console-signal)]/10 text-[var(--color-console-text)]'
        : 'border-[var(--color-console-line)] text-[var(--color-console-text-dim)] hover:border-[var(--color-console-signal)]/50 hover:text-[var(--color-console-text)]'}"
    >
      {s.label}
    </button>
  {/each}
  {#if showHint}
    <span
      class="ml-auto hidden font-mono text-[10px] text-[var(--color-console-text-dim)] sm:inline"
      >←→ pick · ↵ run</span
    >
  {/if}
</div>
