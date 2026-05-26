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
    const timeout = setTimeout(() => {
      isDecoding = true;
      let iteration = 0;
      const length = text.length;

      const interval = setInterval(() => {
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
          clearInterval(interval);
          isDecoding = false;
        }

        iteration += 1 / 3;
      }, 30);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  });
</script>

{#if show}
<span
  class="inline-block {className} {isDecoding ? 'text-[var(--color-primary-container)]' : ''}"
  transition:fade={{ duration: 300 }}
>
  {displayText || text.replace(/./g, '\u00A0')}
</span>
{/if}
