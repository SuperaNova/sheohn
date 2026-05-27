<script lang="ts">
  import { onMount } from 'svelte';
  import ThemeToggle from './ThemeToggle.svelte';

  const navItems = [
    { id: 'home', label: 'Home', path: '/' },
    { id: 'projects', label: 'Projects', path: '/projects' },
    { id: 'about', label: 'About', path: '/about' },
    { id: 'resume', label: 'Resume', path: '/resume.pdf', external: true },
  ];

  let activeId = '';

  onMount(() => {
    const path = window.location.pathname;
    if (path === '/' || path === '/index.html') {
      activeId = 'home';
    } else if (path.startsWith('/projects')) {
      activeId = 'projects';
    } else if (path.startsWith('/about')) {
      activeId = 'about';
    }
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

    <ThemeToggle compact />
  </div>
</header>
