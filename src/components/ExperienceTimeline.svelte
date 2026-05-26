<script lang="ts">
  import { inview } from '../lib/actions/inview';

  const timelineData = [
    {
      id: 'exp-1',
      date: 'Mar 2025 – Dec 2025',
      role: 'AI Trainee Developer',
      organization: 'Ace-1 IT Solutions',
      description:
        'Developed backend systems and AI-driven workflows using n8n and LangChain. Configured on-prem Docker servers, databases, and deployed cloud-based workflows for clients.',
      category: 'Experience',
    },
    {
      id: 'lead-1',
      date: '2025 – Present',
      role: 'President & Campus Organizer',
      organization: 'Google Developer Group on Campus CIT-U',
      description:
        'Leads chapter operations, mentors team members, and expands campus engagement. Previously served as Public Relations Officer (2024-2025).',
      category: 'Leadership',
    },
    {
      id: 'lead-2',
      date: '2025 – Present',
      role: 'Network & Linkages Director',
      organization: 'AWS Cloud Clubs - WildQuacc',
      description:
        'Forges strategic partnerships with campus organizations and the local tech community through targeted outreach, networking, and resource-sharing.',
      category: 'Leadership',
    },
    {
      id: 'lead-3',
      date: '2025',
      role: 'Management Information Team (MIT) Lead',
      organization: 'Angat Bayanihan Volunteer Network',
      description:
        'Developed an information system for public data analysis and coordinated relief deployment to 30,000 families across 44 barangays during the 2025 Bogo earthquake.',
      category: 'Leadership',
    },
    {
      id: 'edu-1',
      date: 'Expected 2027',
      role: 'Bachelor of Science in Computer Science',
      organization: 'Cebu Institute of Technology - University',
      description:
        'Certifications: CodeChum C Certificate, CodeChum Java Certificate.',
      category: 'Education',
    },
  ];
</script>

<div class="mt-20 ml-2 border-l border-white/10 pl-6 md:ml-4 md:pl-10">
  {#each timelineData as item, index (item.id)}
    <div
      class="timeline-item relative mb-12 last:mb-0"
      style:transition-delay="{index * 100}ms"
      use:inview={{ once: true, amount: 0.8 }}
    >
      <!-- Timeline Dot -->
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
