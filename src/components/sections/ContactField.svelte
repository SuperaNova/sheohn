<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props {
    id: string;
    name: string;
    label: string;
    type?: string;
    value: string;
    error?: string;
    autocomplete?: HTMLInputAttributes['autocomplete'];
    minlength?: number;
    maxlength: number;
    rows?: number;
  }

  let {
    id,
    name,
    label,
    type = 'text',
    value = $bindable(),
    error,
    autocomplete,
    minlength,
    maxlength,
    rows,
  }: Props = $props();

  const fieldClass =
    'rounded-lg border border-[var(--color-outline-variant)] bg-[var(--color-surface-container)] px-4 py-3 text-base text-[var(--color-on-surface)] outline-none transition focus:border-[var(--color-tertiary)] focus:ring-2 focus:ring-[var(--color-tertiary)]/30 aria-invalid:border-[var(--color-error)]';
</script>

<div class="grid gap-2">
  <label
    for={id}
    class="text-xs font-semibold tracking-[0.16em] text-[var(--color-on-surface-muted)] uppercase"
  >
    {label}
  </label>
  {#if rows}
    <textarea
      {id}
      {name}
      required
      {minlength}
      {maxlength}
      {rows}
      bind:value
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      class="resize-y {fieldClass}"
    ></textarea>
  {:else}
    <input
      {id}
      {name}
      {type}
      {autocomplete}
      required
      {minlength}
      {maxlength}
      bind:value
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      class={fieldClass}
    />
  {/if}
  {#if error}
    <p id="{id}-error" class="text-sm text-[var(--color-error)]">{error}</p>
  {/if}
</div>
