<script lang="ts">
  import { commandPaletteOpen, toggleTheme } from '../../store';
  import { fade, fly } from 'svelte/transition';
  import { navigate } from 'astro:transitions/client';

  let searchInput = $state<HTMLInputElement>();
  let searchQuery = $state('');
  let selectedIndex = $state(0);

  function goto(path: string) {
    close();
    navigate(path);
  }

  const allCommands = [
    {
      id: 'home',
      label: 'Go to Home',
      action: () => goto('/'),
    },
    {
      id: 'projects',
      label: 'Go to Projects',
      action: () => goto('/projects'),
    },
    {
      id: 'about',
      label: 'Go to About',
      action: () => goto('/about'),
    },
    {
      id: 'contact',
      label: 'Go to Contact',
      action: () => goto('/#contact'),
    },
    {
      id: 'theme',
      label: 'Toggle Dark/Light Mode',
      action: () => {
        toggleTheme();
        close();
      },
    },
    {
      id: 'resume',
      label: 'View Resume',
      action: () => {
        window.open('/resume.pdf', '_blank');
        close();
      },
    },
  ];

  // React to search query
  $effect(() => {
    if (searchQuery) {
      selectedIndex = 0;
    }
  });

  // Filter commands
  let filteredCommands = $derived(
    allCommands.filter((c) =>
      c.label.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  function handleKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      $commandPaletteOpen = !$commandPaletteOpen;
    }

    if (!$commandPaletteOpen) return;

    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedIndex = (selectedIndex + 1) % filteredCommands.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedIndex =
        (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    }
  }

  function close() {
    $commandPaletteOpen = false;
    searchQuery = '';
  }

  // Focus input when opened
  $effect(() => {
    if ($commandPaletteOpen && searchInput) {
      setTimeout(() => searchInput.focus(), 50);
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if $commandPaletteOpen}
  <div class="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
    <button
      type="button"
      aria-label="Close command palette"
      class="fixed inset-0 w-full h-full cursor-default border-none bg-black/60 backdrop-blur-sm transition-opacity"
      onclick={close}
      transition:fade={{ duration: 200 }}
    ></button>

    <div
      class="relative w-full max-w-xl overflow-hidden rounded-xl border border-[var(--color-on-surface-muted)] bg-[var(--color-surface)] shadow-2xl"
      transition:fly={{ y: -20, duration: 200 }}
    >
      <div
        class="flex items-center border-b border-[var(--color-on-surface-muted)] px-4 py-3"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-[var(--color-on-surface-muted)]"
          ><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg
        >
        <input
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text"
          placeholder="Type a command or search..."
          class="w-full bg-transparent px-4 text-lg text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-muted)] focus:outline-none"
        />
        <button
          onclick={close}
          class="rounded-md px-2 py-1 text-xs text-[var(--color-on-surface-muted)] hover:bg-[var(--color-on-surface-muted)]/20 hover:text-[var(--color-on-surface)]"
        >
          ESC
        </button>
      </div>

      <div class="max-h-96 overflow-y-auto py-2">
        {#if filteredCommands.length === 0}
          <div
            class="px-6 py-8 text-center text-sm text-[var(--color-on-surface-muted)]"
          >
            No results found for "{searchQuery}"
          </div>
        {:else}
          <ul class="px-2">
            {#each filteredCommands as cmd, i (cmd.id)}
              <li>
                <button
                  onclick={cmd.action}
                  class="flex w-full items-center rounded-lg px-4 py-3 text-left text-sm transition-all {i ===
                  selectedIndex
                    ? 'bg-[var(--color-on-surface)]/20 text-[var(--color-on-surface)] font-semibold border-l-4 border-[var(--color-tertiary)] shadow-sm'
                    : 'text-[var(--color-on-surface-muted)] border-l-4 border-transparent hover:bg-[var(--color-on-surface)]/5 hover:text-[var(--color-on-surface)]'}"
                  onmouseenter={() => (selectedIndex = i)}
                >
                  {cmd.label}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </div>
{/if}
