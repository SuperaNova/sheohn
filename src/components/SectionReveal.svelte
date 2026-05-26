<script lang="ts">
  import { inview } from '../lib/actions/inview';

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
  .section-reveal {
    opacity: 0;
    transform: translateY(32px) scale(0.985);
    transition: opacity 0.95s cubic-bezier(0.16, 1, 0.3, 1), transform 0.95s cubic-bezier(0.16, 1, 0.3, 1);
  }

  :global(.section-reveal.in-view) {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
</style>
