<script lang="ts">
  import { onMount } from 'svelte';

  export let compact = false;

  let theme: 'light' | 'dark' = 'dark';

  function getPreferredTheme() {
    if (typeof window === 'undefined') return 'dark';
    const saved = window.localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  onMount(() => {
    theme = getPreferredTheme();
    document.documentElement.classList.toggle('dark', theme === 'dark');
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('theme', theme);
  }
</script>

<button
  type="button"
  on:click={toggleTheme}
  class="theme-toggle transition-transform hover:-translate-y-[2px] hover:scale-[1.03] active:scale-[0.98] {compact
    ? 'rounded-md bg-[var(--color-surface-container-high)] px-3 py-2 text-[11px] font-semibold tracking-[0.12em] text-[var(--color-on-surface)] shadow-[0_8px_20px_rgba(0,0,0,0.25)]'
    : 'glass-island fixed top-6 right-6 z-50 rounded-lg px-4 py-2 text-xs font-semibold tracking-[0.12em] text-[var(--color-on-surface)] shadow-[0_16px_32px_rgba(0,0,0,0.25)]'}"
  aria-label="Toggle color theme"
>
  {theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
</button>
