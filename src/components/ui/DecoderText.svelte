<script lang="ts">
  import { onMount } from 'svelte';
  import { prefersReducedMotion } from '../../lib/motion';

  let {
    text,
    delay = 0,
    class: className = '',
  }: { text: string; delay?: number; class?: string } = $props();

  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';

  let displayText = $state('');
  let isDecoding = $state(false);

  onMount(() => {
    // Reduced motion: skip the scramble entirely, show the resolved text.
    if (prefersReducedMotion()) {
      displayText = text;
      return;
    }

    let rafId: number;
    const timeout = setTimeout(() => {
      isDecoding = true;
      const length = text.length;
      const startTime = performance.now();
      const msPerStep = 30;
      const stepsPerIteration = 3;

      function tick(now: number) {
        const elapsed = now - startTime;
        const iteration = elapsed / msPerStep / stepsPerIteration;

        displayText = text
          .split('')
          .map((letter, index) => {
            if (index < iteration) {
              return text[index];
            }
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join('');

        if (iteration >= length) {
          isDecoding = false;
        } else {
          rafId = requestAnimationFrame(tick);
        }
      }

      rafId = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafId);
    };
  });
</script>

<span class={className}>
  <!-- Stable accessible name: assistive tech reads the resolved text once,
       never the per-frame scramble. -->
  <span class="sr-only">{text}</span>
  <span
    aria-hidden="true"
    class="inline-block {isDecoding
      ? 'text-[var(--color-primary-container)]'
      : ''}"
  >
    {displayText || text}
  </span>
</span>
