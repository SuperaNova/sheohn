<script lang="ts">
  import { onMount } from 'svelte';
  import { theme, initTheme, toggleTheme } from '../store';

  let { compact = false }: { compact?: boolean } = $props();

  onMount(() => {
    initTheme();
  });
</script>

<button
  type="button"
  onclick={toggleTheme}
  class="theme-toggle transition-transform hover:-translate-y-[2px] hover:scale-[1.03] active:scale-[0.98] {compact
    ? 'rounded-md bg-[var(--color-surface-container-high)] px-3 py-2 text-[11px] font-semibold tracking-[0.12em] text-[var(--color-on-surface)] shadow-[0_8px_20px_rgba(0,0,0,0.25)]'
    : 'glass-island fixed top-6 right-6 z-50 rounded-lg px-4 py-2 text-xs font-semibold tracking-[0.12em] text-[var(--color-on-surface)] shadow-[0_16px_32px_rgba(0,0,0,0.25)]'}"
  aria-label="Toggle color theme"
>
  {$theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
</button>
