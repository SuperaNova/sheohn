<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let isVisible = false;
  let isGreenHover = false;
  let mouseX = -100;
  let mouseY = -100;

  function updateMousePosition(e: MouseEvent) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    isVisible = true;
  }

  let mouseOverRafId = 0;
  function handleMouseOver(e: MouseEvent) {
    cancelAnimationFrame(mouseOverRafId);
    mouseOverRafId = requestAnimationFrame(() => {
      const target = e.target as HTMLElement;
      const isGreen =
        target.hasAttribute('data-cursor-green') ||
        target.closest('[data-cursor-green]');
      isGreenHover = !!isGreen;
    });
  }

  function handleMouseLeave() {
    isVisible = false;
  }

  function handleMouseEnter() {
    isVisible = true;
  }

  onMount(() => {
    window.addEventListener('mousemove', updateMousePosition, {
      passive: true,
    });
    window.addEventListener('mouseover', handleMouseOver);
    document.body.addEventListener('mouseleave', handleMouseLeave);
    document.body.addEventListener('mouseenter', handleMouseEnter);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', updateMousePosition);
      window.removeEventListener('mouseover', handleMouseOver);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
      document.body.removeEventListener('mouseenter', handleMouseEnter);
      cancelAnimationFrame(mouseOverRafId);
    }
  });
</script>

<div
  class="cursor-dot pointer-events-none fixed top-0 left-0 z-[9999] hidden rounded-full md:block {isGreenHover
    ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]'
    : 'bg-[var(--color-on-surface)] shadow-[0_2px_8px_rgba(0,0,0,0.15)]'}"
  style:transform="translate({mouseX}px, {mouseY}px) translate(-50%, -50%)"
  style:width="20px"
  style:height="20px"
  style:opacity={isVisible ? 1 : 0}
></div>

<style>
  .cursor-dot {
    transition:
      opacity 0.15s ease-out,
      background-color 0.2s,
      box-shadow 0.2s;
  }

  /* Hide the system cursor only when the user hasn't requested reduced motion.
     Assistive-tech users who set prefers-reduced-motion keep their real cursor. */
  @media (pointer: fine) and (prefers-reduced-motion: no-preference) {
    :global(*),
    :global(body),
    :global(a),
    :global(button),
    :global(input) {
      cursor: none !important;
    }
  }
</style>
