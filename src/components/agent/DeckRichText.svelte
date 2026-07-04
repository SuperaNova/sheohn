<script lang="ts">
  import { linkify } from './linkify';
  import type { RagFact } from '../../lib/rag';

  // `facts`: the kept (>= RAG_MIN_SCORE) query_jared_memory results that
  // grounded this reply, if any. Correlating footnote numbers to specific
  // sentences in freeform LLM text is inherently heuristic, so — per spec
  // #03's locked design — all cited facts are appended as a numbered
  // footnote list after the text rather than positioned inline. Each marker
  // is a hover/click target that reveals that citation's fact text + score.
  let { text, facts = [] }: { text: string; facts?: RagFact[] } = $props();

  // Hover and click track SEPARATE state (hover vs. pinned) so the two
  // gestures can't fight: a pointer click fires mouseenter before click, and
  // a touch tap synthesizes mouseenter+click with no mouseleave ever coming —
  // a single openIndex toggled by both would open-then-instantly-close on
  // click and never open at all on touch. The panel shows when its marker is
  // hovered OR pinned; click/tap toggles the pin (clearing hover on unpin so
  // a second tap actually closes it on touch); Escape and focus loss unpin.
  let hoveredIndex = $state<number | null>(null);
  let pinnedIndex = $state<number | null>(null);

  function isOpen(i: number): boolean {
    return hoveredIndex === i || pinnedIndex === i;
  }

  function handleClick(i: number) {
    if (pinnedIndex === i) {
      pinnedIndex = null;
      hoveredIndex = null;
    } else {
      pinnedIndex = i;
    }
  }

  function closeCitation(i: number) {
    if (pinnedIndex === i) pinnedIndex = null;
    if (hoveredIndex === i) hoveredIndex = null;
  }
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

{#if facts.length}
  <div
    class="mt-2 flex flex-wrap items-start gap-1.5 border-t border-[var(--color-console-line)]/50 pt-1.5"
  >
    {#each facts as fact, i (fact.id)}
      <div class="relative">
        <button
          type="button"
          class="rounded px-1 font-mono text-[10px] text-[var(--color-console-signal)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--color-console-signal-strong)]"
          aria-expanded={isOpen(i)}
          aria-label={`citation ${i + 1}, score ${fact.score.toFixed(2)}`}
          onmouseenter={() => (hoveredIndex = i)}
          onmouseleave={() => {
            if (hoveredIndex === i) hoveredIndex = null;
          }}
          onclick={() => handleClick(i)}
          onfocus={() => (hoveredIndex = i)}
          onblur={() => closeCitation(i)}
          onkeydown={(e) => {
            if (e.key === 'Escape') closeCitation(i);
          }}
        >
          [{i + 1}]
        </button>
        {#if isOpen(i)}
          <div
            role="note"
            class="absolute bottom-full left-0 z-10 mb-1 w-64 max-w-[70vw] rounded-lg border border-[var(--color-console-line)] bg-[var(--color-console-surface)] p-2 font-mono text-[11px] text-[var(--color-console-text)] shadow-2xl"
          >
            <p class="text-[var(--color-console-text-dim)]">
              score {fact.score.toFixed(3)}
            </p>
            <p class="mt-1 whitespace-pre-wrap">{fact.text}</p>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
