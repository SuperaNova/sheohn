<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import ThemeToggle from './ThemeToggle.svelte';

  const navItems = [
    { id: 'home', label: 'Home', path: '/' },
    { id: 'projects', label: 'Projects', path: '/projects' },
    { id: 'about', label: 'About', path: '/about' },
    { id: 'contact', label: 'Contact', path: '/#contact' },
    { id: 'resume', label: 'Resume', path: '/resume.pdf', external: true },
  ];

  let activeId = $state('');
  let isMenuOpen = $state(false);

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

  onMount(() => {
    computeActive();
    // Recompute + close the menu on every view-transition navigation, so the
    // active underline tracks the page even when hydration is slow (throttled
    // mobile) or the header instance survives a swap.
    const onPageLoad = () => {
      computeActive();
      isMenuOpen = false;
    };
    document.addEventListener('astro:page-load', onPageLoad);
    return () => document.removeEventListener('astro:page-load', onPageLoad);
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

    <nav class="hidden items-center gap-6 md:flex">
      {#each navItems as section (section.id)}
        {@const isActive = activeId === section.id}
        <a
          href={section.path}
          target={section.external ? '_blank' : undefined}
          rel={section.external ? 'noreferrer' : undefined}
          class="text-sm font-medium transition hover:text-[var(--color-on-surface)] {isActive
            ? 'text-[var(--color-on-surface)] underline decoration-[var(--color-tertiary)] decoration-2 underline-offset-8'
            : 'text-[var(--color-on-surface-muted)]'}"
        >
          {section.label}
        </a>
      {/each}
    </nav>

    <!-- Hamburger / Close button (mobile only) -->
    <div class="flex items-center gap-3 md:hidden">
      <ThemeToggle compact />
      <button
        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        class="text-[var(--color-on-surface)] transition hover:text-[var(--color-tertiary)]"
        onclick={() => (isMenuOpen = !isMenuOpen)}
      >
        {#if isMenuOpen}
          <!-- X icon -->
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
          <!-- Hamburger icon -->
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

    <!-- Desktop ThemeToggle (hidden on mobile, shown via mobile menu instead) -->
    <div class="hidden md:block">
      <ThemeToggle compact />
    </div>
  </div>
  <!-- Mobile slide-down menu -->
  {#if isMenuOpen}
    <nav
      transition:slide={{ duration: 250 }}
      class="border-b-2 border-[var(--color-on-surface-muted)] bg-[var(--color-surface)]/95 backdrop-blur-md md:hidden"
    >
      <div class="mx-auto flex max-w-[90rem] flex-col gap-4 px-6 py-5">
        {#each navItems as section (section.id)}
          {@const isActive = activeId === section.id}
          <a
            href={section.path}
            target={section.external ? '_blank' : undefined}
            rel={section.external ? 'noreferrer' : undefined}
            class="text-sm font-medium transition hover:text-[var(--color-on-surface)] {isActive
              ? 'text-[var(--color-on-surface)] underline decoration-[var(--color-tertiary)] decoration-2 underline-offset-8'
              : 'text-[var(--color-on-surface-muted)]'}"
            onclick={() => (isMenuOpen = false)}
          >
            {section.label}
          </a>
        {/each}
      </div>
    </nav>
  {/if}
</header>
