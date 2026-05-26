<script lang="ts">
  import { spring } from 'svelte/motion';

  let scrollY = 0;
  let scrollHeight = 0;
  let innerHeight = 0;

  const progress = spring(0, {
    stiffness: 0.12,
    damping: 0.3,
  });

  $: {
    if (scrollHeight > innerHeight && innerHeight > 0) {
      $progress = scrollY / (scrollHeight - innerHeight);
    } else {
      $progress = 0;
    }
  }
</script>

<svelte:window bind:scrollY bind:innerHeight />

<svelte:body bind:clientHeight={scrollHeight} />

<div
  class="fixed top-0 right-0 left-0 z-[60] h-[2px] origin-left bg-[var(--color-tertiary)]"
  style:transform="scaleX({$progress})"
></div>
