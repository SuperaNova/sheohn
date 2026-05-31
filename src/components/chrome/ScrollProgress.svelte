<script lang="ts">
  import { Spring } from 'svelte/motion';
  import { scrollState } from '../../store';

  let scrollY = $state(0);
  let scrollHeight = $state(0);
  let innerHeight = $state(0);

  const progress = new Spring(0, {
    stiffness: 0.12,
    damping: 0.3,
  });

  $effect(() => {
    if (scrollHeight > innerHeight && innerHeight > 0) {
      progress.target = scrollY / (scrollHeight - innerHeight);
    } else {
      progress.target = 0;
    }
    scrollState.set({ scrollY, scrollHeight, innerHeight });
  });
</script>

<svelte:window bind:scrollY bind:innerHeight />

<svelte:body bind:clientHeight={scrollHeight} />

<div
  class="fixed top-0 right-0 left-0 z-[60] h-[2px] origin-left bg-[var(--color-tertiary)]"
  style:transform="scaleX({progress.current})"
></div>
