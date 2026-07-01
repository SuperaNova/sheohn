<script lang="ts">
  type DeckCommand = { name: string; label: string; run: () => void };

  let {
    commands,
    selectedIndex,
    inputValue,
    maxHeightPx,
    onHover,
  }: {
    commands: DeckCommand[];
    selectedIndex: number;
    inputValue: string;
    maxHeightPx: number;
    onHover: (i: number) => void;
  } = $props();
</script>

<ul
  id="deck-command-list"
  role="listbox"
  aria-label="Commands"
  style:max-height={maxHeightPx ? `${maxHeightPx}px` : undefined}
  class="max-h-72 overflow-y-auto p-2 font-mono text-sm"
>
  {#if commands.length === 0}
    <li class="px-3 py-4 text-center text-[var(--color-console-text-dim)]">
      no command matches "{inputValue.trimStart().slice(1)}"
    </li>
  {:else}
    {#each commands as cmd, i (cmd.name)}
      <li>
        <button
          type="button"
          role="option"
          id={`deck-cmd-${i}`}
          aria-selected={i === selectedIndex}
          onclick={cmd.run}
          onmouseenter={() => onHover(i)}
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors pointer-coarse:min-h-[44px] {i ===
          selectedIndex
            ? 'bg-[var(--color-console-signal)]/15 text-[var(--color-console-text)]'
            : 'text-[var(--color-console-text-dim)] hover:bg-white/5'}"
        >
          <span class="text-[var(--color-console-signal)]">/{cmd.name}</span>
          <span class="text-xs">{cmd.label}</span>
        </button>
      </li>
    {/each}
  {/if}
</ul>
