<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import type { BootInfo } from '../../lib/boot-info';
  import { buildLoaderLines } from '../../lib/dmesg';

  // bootInfo is computed at build time (src/lib/boot-data.ts, Astro
  // frontmatter only) and handed down as a plain prop — see
  // CommandDeck.svelte for the same plumbing. Defaulted defensively so this
  // never breaks if ever rendered without it.
  let {
    bootInfo = {
      commitSha: 'dev',
      buildTimestamp: new Date().toISOString(),
      dependencyCount: 0,
    },
  }: { bootInfo?: BootInfo } = $props();

  const lines = $derived.by(() => buildLoaderLines(bootInfo));

  // Non-linear reveal cadence: quick bursts (~30-70ms) with a couple of
  // longer beats, deterministic (no Math.random) so this stays screenshot-
  // and e2e-stable. Distinct from each line's displayed dmesg timestamp,
  // which is a separate fake kernel clock (see dmesg.ts).
  const LINE_DELAYS_MS = [
    40, 35, 45, 130, 40, 50, 160, 45, 35, 50, 120, 40, 45, 100, 40, 180, 60,
  ];
  const HOLD_MS = 200;

  let isLoading = $state(true);
  let lineCount = $state(0);
  let logEl = $state<HTMLElement | null>(null);
  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    isLoading = false;
    document.body.style.overflow = '';
  }

  // Skippable on any key/click — instantly reveals every remaining line.
  function skip() {
    if (finished) return;
    lineCount = lines.length;
    finish();
  }

  $effect(() => {
    void lineCount;
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  });

  onMount(() => {
    if (
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('skip-loader')
    ) {
      finished = true;
      isLoading = false;
      return;
    }

    document.body.style.overflow = 'hidden';

    // Respect reduced motion: skip the boot animation, show the end state.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      lineCount = lines.length;
      const t = setTimeout(finish, HOLD_MS);
      return () => {
        clearTimeout(t);
        document.body.style.overflow = '';
      };
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    lines.forEach((_, i) => {
      elapsed += LINE_DELAYS_MS[i] ?? 50;
      timers.push(
        setTimeout(() => {
          lineCount = i + 1;
        }, elapsed),
      );
    });
    timers.push(setTimeout(finish, elapsed + HOLD_MS));

    return () => {
      timers.forEach(clearTimeout);
      document.body.style.overflow = '';
    };
  });

  function handleKeydown(e: KeyboardEvent) {
    // Loader itself never unmounts (persistent client:load island) so this
    // listener can't be scoped to <svelte:window> inside {#if isLoading} —
    // it must no-op itself once finished, or it would swallow every
    // keystroke on the page forever (e.g. Enter in the command deck).
    if (finished) return;
    // Any key skips — don't let it also scroll the page or trigger a
    // browser default (space, "/", arrows) while the overlay is up.
    e.preventDefault();
    skip();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isLoading}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div
    id="global-loader"
    role="log"
    aria-label="Boot sequence"
    aria-live="polite"
    bind:this={logEl}
    onclick={skip}
    out:fly={{ y: '-100%', duration: 500, easing: cubicOut }}
    class="fixed inset-0 z-[200] overflow-y-auto bg-[var(--color-console-surface)] p-4 font-mono text-[11px] leading-snug text-[var(--color-console-text)] sm:p-6 sm:text-[13px]"
  >
    {#each lines.slice(0, lineCount) as line (line.ts)}
      <div>
        <span class="whitespace-pre text-[var(--color-console-signal)]"
          >{line.ts}</span
        >
        {#if line.tag}
          <span class="text-[var(--color-console-warn)]">{line.tag}:</span>
        {/if}
        {line.text}
      </div>
    {/each}
  </div>
{/if}
