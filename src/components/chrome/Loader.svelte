<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let progress = $state(0);
  let isLoading = $state(true);
  let lineCount = $state(0);

  const bootLines = [
    'booting sheohn.os',
    'mounting modules … ok',
    'loading agent core … ok',
    'system ready',
  ];

  onMount(() => {
    if (
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('skip-loader')
    ) {
      isLoading = false;
      return;
    }

    document.body.style.overflow = 'hidden';

    const finish = () => {
      isLoading = false;
      document.body.style.overflow = '';
    };

    // Respect reduced motion: skip the boot animation, show the end state.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      progress = 100;
      lineCount = bootLines.length;
      const t = setTimeout(finish, 200);
      return () => {
        clearTimeout(t);
        document.body.style.overflow = '';
      };
    }

    const duration = 800;
    const startTime = performance.now();
    let rafId: number;

    // Reveal boot-log lines one at a time as the bar fills.
    const lineId = setInterval(() => {
      if (lineCount < bootLines.length) lineCount += 1;
    }, 170);

    function tick(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - t, 4);
      progress = Math.min(Math.round(easeOutQuart * 100), 100);

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        clearInterval(lineId);
        lineCount = bootLines.length;
        setTimeout(finish, 200);
      }
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(lineId);
      document.body.style.overflow = '';
    };
  });
</script>

{#if isLoading}
  <div
    id="global-loader"
    out:fly={{ y: '-100%', duration: 500, easing: cubicOut }}
    class="fixed inset-0 z-[200] flex flex-col justify-end bg-[var(--color-console-surface)] p-6 font-mono text-[var(--color-console-text)] md:p-12"
  >
    <!-- Faint architectural grid backdrop -->
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.06]"
      style:background-image="linear-gradient(to right,
      var(--color-console-text) 1px, transparent 1px), linear-gradient(to
      bottom, var(--color-console-text) 1px, transparent 1px)"
      style:background-size="4rem 4rem"
    ></div>

    <div class="relative z-10">
      <!-- Boot log -->
      <div
        class="mb-8 space-y-1 text-xs text-[var(--color-console-text-dim)] sm:text-sm"
      >
        {#each bootLines.slice(0, lineCount) as line (line)}
          <div>
            <span class="text-[var(--color-console-signal)]">›</span>
            {line}
          </div>
        {/each}
      </div>

      <div class="flex w-full items-end justify-between">
        <div
          class="text-xs tracking-[0.24em] text-[var(--color-console-text-dim)] uppercase"
        >
          System Initialization
        </div>
        <div class="text-7xl leading-none tracking-tighter md:text-9xl">
          {progress}%
        </div>
      </div>

      <div class="mt-6 h-[2px] w-full overflow-hidden bg-white/10">
        <div
          class="h-full bg-[var(--color-console-signal)] transition-all duration-100 ease-linear"
          style:width="{progress}%"
        ></div>
      </div>
    </div>
  </div>
{/if}
