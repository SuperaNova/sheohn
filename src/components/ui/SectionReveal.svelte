<script lang="ts">
  import { inview } from '../../lib/actions/inview';

  let { id = '', class: klass = '', className = '', children } = $props();
</script>

<section
  {id}
  class="section-reveal {klass || className}"
  use:inview={{ once: true, amount: 0.2 }}
>
  {@render children()}
</section>

<style>
  @media (prefers-reduced-motion: no-preference) {
    :global(html.js-reveal) .section-reveal {
      opacity: 0;
      transform: translateY(32px) scale(0.985);
      transition:
        opacity 0.95s cubic-bezier(0.16, 1, 0.3, 1),
        transform 0.95s cubic-bezier(0.16, 1, 0.3, 1);
    }
  }

  /* .in-view is added at runtime by the inview action, so mark it :global() (so
     Svelte never prunes this rule) while keeping .section-reveal scoped, which
     also makes this outrank the html.js-reveal hidden rule above. */
  :global(html.js-reveal) .section-reveal:global(.in-view) {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
</style>
