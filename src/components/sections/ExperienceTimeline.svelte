<script lang="ts">
  import { inview } from '../../lib/actions/inview';

  import { personalInfo } from '../../data/personalInfo';

  const timelineData = personalInfo.experience;
</script>

<div
  class="mt-20 ml-2 border-l border-[var(--color-on-surface-muted)]/30 pl-6 md:ml-4 md:pl-10"
>
  {#each timelineData as item, index (item.id)}
    <div
      class="timeline-item relative mb-12 last:mb-0"
      style:transition-delay="{index * 100}ms"
      use:inview={{ once: true, amount: 0.8 }}
    >
      <div
        class="absolute top-1.5 -left-[31px] h-3 w-3 rounded-full bg-[var(--color-primary-container)] ring-4 ring-[var(--color-surface-container-low)] md:-left-[47px]"
      ></div>

      <div
        class="mb-2 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between"
      >
        <h3 class="text-xl font-semibold text-[var(--color-on-surface)]">
          {item.role}
        </h3>
        <span
          class="shrink-0 text-sm font-medium tracking-widest text-[var(--color-tertiary)] uppercase sm:text-right"
        >
          {item.date}
        </span>
      </div>

      <h4 class="mb-4 text-base text-[var(--color-primary-container)]">
        {item.organization}
      </h4>

      <p
        class="max-w-3xl text-sm leading-relaxed text-[var(--color-on-surface-muted)]"
      >
        {item.description}
      </p>
    </div>
  {/each}
</div>

<style>
  .timeline-item {
    opacity: 0;
    transform: translateX(-20px);
    transition:
      opacity 0.5s ease,
      transform 0.5s ease;
  }

  :global(.timeline-item.in-view) {
    opacity: 1;
    transform: translateX(0);
  }
</style>
