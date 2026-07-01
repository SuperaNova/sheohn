<script lang="ts">
  import { linkify } from './linkify';

  let { text }: { text: string } = $props();
</script>

{#each linkify(text) as seg, si (si)}
  {#if seg.kind === 'link'}
    <a
      href={seg.href}
      target="_blank"
      rel="noreferrer noopener"
      class="text-[var(--color-console-signal)] underline underline-offset-2 transition-colors hover:text-[var(--color-console-signal-strong)]"
      >{seg.label}</a
    >
  {:else}<span>{seg.value}</span>{/if}
{/each}
