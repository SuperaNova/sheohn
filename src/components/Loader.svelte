<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let progress = 0;
  let isLoading = true;

  onMount(() => {
    if (
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('skip-loader')
    ) {
      isLoading = false;
      return;
    }

    document.body.style.overflow = 'hidden';

    const duration = 1200;
    const intervalTime = 20;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const Math_pow = Math.pow(1 - currentStep / steps, 4);
      const easeOutQuart = 1 - Math_pow;
      progress = Math.min(Math.round(easeOutQuart * 100), 100);

      if (currentStep >= steps) {
        clearInterval(interval);
        setTimeout(() => {
          isLoading = false;
          document.body.style.overflow = '';
        }, 400);
      }
    }, intervalTime);

    return () => {
      clearInterval(interval);
      document.body.style.overflow = '';
    };
  });
</script>

{#if isLoading}
  <div
    id="global-loader"
    out:fly={{ y: '-100%', duration: 800, easing: cubicOut }}
    class="bg-[var(--color-surface)] text-[var(--color-on-surface)] fixed inset-0 z-[100] flex flex-col justify-end p-6 md:p-12"
  >
    <!-- Faint Architectural Grid Backdrop for loader -->
    <div
      class="pointer-events-none absolute inset-0 opacity-20 transition-opacity"
      style:background-image="linear-gradient(to right,
      var(--color-on-surface-muted) 1px, transparent 1px), linear-gradient(to
      bottom, var(--color-on-surface-muted) 1px, transparent 1px)"
      style:background-size="4rem 4rem"
    ></div>

    <div class="relative z-10 flex w-full items-end justify-between">
      <div
        class="text-xs tracking-[0.24em] text-[var(--color-on-surface-muted)] uppercase fade-in"
      >
        System Initialization
      </div>
      <div
        class="font-display text-7xl leading-none tracking-tighter md:text-9xl"
      >
        {progress}%
      </div>
    </div>

    <div
      class="relative z-10 mt-6 h-[1px] w-full overflow-hidden bg-[var(--color-surface-container-highest)]"
    >
      <div
        class="h-full bg-[var(--color-on-surface)] transition-all duration-100 ease-linear"
        style:width="{progress}%"
      ></div>
    </div>
  </div>
{/if}

<style>
  .fade-in {
    animation: fadeIn 0.5s ease forwards;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
