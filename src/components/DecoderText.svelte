<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  export let text: string;
  export let delay = 0;
  let className = '';
  export { className as class };

  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';

  let displayText = '';
  let isDecoding = false;
  let show = false;

  onMount(() => {
    show = true;
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

{#if show}
  <span
    class="inline-block {className} {isDecoding
      ? 'text-[var(--color-primary-container)]'
      : ''}"
    transition:fade={{ duration: 300 }}
  >
    {displayText || text.replace(/./g, '\u00A0')}
  </span>
{/if}
