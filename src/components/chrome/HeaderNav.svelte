<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';

  import ThemeToggle from './ThemeToggle.svelte';
  import { personalInfo } from '../../data/personalInfo';

  const navItems = [
    { id: 'home', label: 'home', path: '/' },
    { id: 'projects', label: 'projects', path: '/projects' },
    { id: 'about', label: 'about', path: '/about' },
    {
      id: 'resume',
      label: 'resume',
      path: personalInfo.resumeUrl,
      external: true,
    },
  ];

  let activeId = $state('');
  let isMenuOpen = $state(false);
  // Set client-side only (kept empty on the server) to avoid a hydration
  // mismatch on the live clock.
  let clock = $state('');

  function computeActive() {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') {
      activeId = 'home';
    } else if (path.startsWith('/projects')) {
      activeId = 'projects';
    } else if (path.startsWith('/about')) {
      activeId = 'about';
    } else {
      activeId = '';
    }
  }

  // GitHub-style local time, e.g. "19:39 (UTC+08:00)".
  function tickClock() {
    const d = new Date();
    const time = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: personalInfo.timezone,
    }).format(d);
    const offset = (
      new Intl.DateTimeFormat('en-US', {
        timeZone: personalInfo.timezone,
        timeZoneName: 'longOffset',
      })
        .formatToParts(d)
        .find((p) => p.type === 'timeZoneName')?.value ?? 'UTC'
    ).replace('GMT', 'UTC');
    clock = `${time} (${offset})`;
  }

  onMount(() => {
    computeActive();
    tickClock();
    const clockId = setInterval(tickClock, 30_000);
    // Recompute + close the menu on every view-transition navigation, so the
    // active marker tracks the page even when hydration is slow.
    const onPageLoad = () => {
      computeActive();
      isMenuOpen = false;
    };
    document.addEventListener('astro:page-load', onPageLoad);
    return () => {
      clearInterval(clockId);
      document.removeEventListener('astro:page-load', onPageLoad);
    };
  });
</script>

<header
  class="fixed inset-x-0 top-0 z-50 border-b-2 border-[var(--color-on-surface-muted)] bg-[var(--color-surface)]/95 backdrop-blur-md"
>
  <div
    class="mx-auto flex h-16 w-full max-w-[90rem] items-center justify-between px-6 md:px-10"
  >
    <a
      href="/"
      class="font-display text-xl font-bold tracking-wide text-[var(--color-on-surface)]"
    >
      sheohn<span class="text-[var(--color-tertiary)]">.dev</span>
    </a>

    <nav class="hidden items-center gap-6 font-mono text-[13px] md:flex">
      {#each navItems as section (section.id)}
        {@const isActive = activeId === section.id}
        <a
          href={section.path}
          target={section.external ? '_blank' : undefined}
          rel={section.external ? 'noreferrer' : undefined}
          class="tracking-wide transition {isActive
            ? 'text-[var(--color-tertiary)] underline decoration-2 underline-offset-[6px]'
            : 'text-[var(--color-on-surface-muted)] hover:text-[var(--color-on-surface)]'}"
        >
          {section.label}
        </a>
      {/each}
    </nav>

    <div class="hidden items-center gap-4 md:flex">
      {#if clock}
        <div
          class="hidden min-w-[8.5rem] items-center justify-end gap-1.5 font-mono text-[11px] tracking-wide text-[var(--color-on-surface-muted)] lg:flex"
          title="Jared's local time"
        >
          <svg
            class="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span class="tabular-nums">{clock}</span>
        </div>
      {/if}
      <ThemeToggle compact />
    </div>

    <div class="flex items-center gap-3 md:hidden">
      <ThemeToggle compact />
      <button
        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        class="text-[var(--color-on-surface)] transition hover:text-[var(--color-tertiary)]"
        onclick={() => (isMenuOpen = !isMenuOpen)}
      >
        {#if isMenuOpen}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        {/if}
      </button>
    </div>
  </div>

  {#if isMenuOpen}
    <nav
      transition:slide={{ duration: 250 }}
      class="border-b-2 border-[var(--color-on-surface-muted)] bg-[var(--color-surface)]/95 font-mono backdrop-blur-md md:hidden"
    >
      <div class="mx-auto flex max-w-[90rem] flex-col gap-4 px-6 py-5">
        {#each navItems as section (section.id)}
          {@const isActive = activeId === section.id}
          <a
            href={section.path}
            target={section.external ? '_blank' : undefined}
            rel={section.external ? 'noreferrer' : undefined}
            class="text-sm tracking-wide transition {isActive
              ? 'text-[var(--color-tertiary)] underline decoration-2 underline-offset-[6px]'
              : 'text-[var(--color-on-surface-muted)] hover:text-[var(--color-on-surface)]'}"
            onclick={() => (isMenuOpen = false)}
          >
            {section.label}
          </a>
        {/each}
        {#if clock}
          <div
            class="mt-2 flex items-center gap-2 border-t border-[var(--color-outline-variant)] pt-4 font-mono text-[11px] tracking-wide text-[var(--color-on-surface-muted)]"
          >
            <svg
              class="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span class="tabular-nums">{clock}</span>
          </div>
        {/if}
      </div>
    </nav>
  {/if}
</header>
