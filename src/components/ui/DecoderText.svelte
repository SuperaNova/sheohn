<script lang="ts">
  import { onMount } from 'svelte';

  let {
    text,
    delay = 0,
    class: className = '',
  }: { text: string; delay?: number; class?: string } = $props();

  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';

  let displayText = $state('');
  let isDecoding = $state(false);

  onMount(() => {
    let rafId: number;
    const timeout = setTimeout(() => {
      isDecoding = true;
      const length = text.length;
      const startTime = performance.now();
      const msPerStep = 30; // match original 30ms interval
      const stepsPerIteration = 3; // match original iteration += 1/3

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

<span
  class="inline-block {className} {isDecoding
    ? 'text-[var(--color-primary-container)]'
    : ''}"
>
  {displayText || text}
</span>
