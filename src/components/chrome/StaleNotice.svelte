<script lang="ts">
  import { onMount } from 'svelte';
  import { currentNotice } from '../../lib/stale-notice';

  let { reviewedOn }: { reviewedOn: string } = $props();

  const DISMISS_KEY = 'notice-dismissed';

  let text = $state('');
  let visible = $state(false);
  let topOffset = $state(64);

  function readDismissed(): boolean {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  }

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable; hide for this page view only */
    }
    visible = false;
    document.documentElement.removeAttribute('data-notice');
  }

  onMount(() => {
    const notice = currentNotice(reviewedOn);
    if (!notice.show || readDismissed()) return;
    topOffset = document.querySelector('header')?.offsetHeight ?? 64;
    text = notice.text;
    visible = true;
    document.documentElement.setAttribute('data-notice', '');
    return () => document.documentElement.removeAttribute('data-notice');
  });
</script>

{#if visible}
  <div
    role="status"
    data-testid="stale-notice"
    class="fixed inset-x-0 z-40 flex h-8 items-center gap-3 border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-container-high)] px-6 font-mono text-[11px] tracking-wide text-[var(--color-on-surface-muted)] md:px-10"
    style:top="{topOffset}px"
  >
    <p class="min-w-0 flex-1 truncate">
      <span aria-hidden="true" class="opacity-70">›</span>
      {text}
    </p>
    <button
      type="button"
      aria-label="Dismiss notice"
      class="shrink-0 px-1 transition hover:text-[var(--color-tertiary)]"
      onclick={dismiss}
    >
      ✕
    </button>
  </div>
{/if}
