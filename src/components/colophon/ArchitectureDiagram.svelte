<script lang="ts">
  // Hand-drawn inline SVG — no chart/diagram library. Node selection state
  // drives SVG presentation attributes directly ($derived below) rather than
  // toggling CSS classes, so there's no scoped-CSS-pruning risk; the detail
  // panel itself is a plain {#if} block for the same reason.
  interface DiagramNode {
    id: string;
    title: string;
    subtitle: string;
    x: number;
    y: number;
    w: number;
    h: number;
    detail: string;
  }

  const NODES: DiagramNode[] = [
    {
      id: 'astro',
      title: 'Astro Islands',
      subtitle: 'client:* hydration',
      x: 220,
      y: 20,
      w: 200,
      h: 60,
      detail:
        "Astro 6, output: 'static' — every page is prerendered HTML. Interactive pieces hydrate selectively as Svelte 5 islands: client:load for chrome that must be ready instantly (HeaderNav, Loader), client:idle for the docked CommandDeck, client:visible for below-the-fold islands like this diagram.",
    },
    {
      id: 'ci',
      title: 'CI',
      subtitle: 'GitHub Actions',
      x: 460,
      y: 20,
      w: 160,
      h: 60,
      detail:
        '.github/workflows/ci.yml runs on every push/PR to main: Prettier, ESLint, astro check, svelte-check, knip, and a secret scan, then a stub-secret production build. A separate job runs vitest with coverage, and pull requests also get desktop + mobile Lighthouse audits.',
    },
    {
      id: 'agent',
      title: 'Agent Loop',
      subtitle: '/api/chat',
      x: 220,
      y: 150,
      w: 200,
      h: 64,
      detail:
        'POST /api/chat streams responses from Gemini (gemini-3.1-flash-lite) via the Vercel AI SDK. Six tools are exposed to the model — open_case_study, open_resume, focus_section, set_theme, trigger_ui_state, query_jared_memory — capped at 5 tool-call steps and a 25s total timeout.',
    },
    {
      id: 'rag',
      title: 'RAG',
      subtitle: 'Upstash Vector',
      x: 40,
      y: 290,
      w: 200,
      h: 64,
      detail:
        "query_jared_memory embeds the visitor's question with gemini-embedding-001 at 1536 dimensions, then queries Upstash Vector for the top 6 nearest facts. Only matches scoring ≥ 0.75 ground the answer as cited footnotes; the rest surface only via the /trace command.",
    },
    {
      id: 'ratelimit',
      title: 'Rate Limiter',
      subtitle: 'Upstash Redis',
      x: 400,
      y: 290,
      w: 200,
      h: 64,
      detail:
        "createRateLimiter('ratelimit_chat', 10, '1 m') caps /api/chat at 10 requests/minute per client IP on a sliding window. safeLimit() fails open: if Upstash Redis itself is unreachable, the request proceeds rather than 500ing — throttling is a guard, not a dependency.",
    },
  ];

  let selectedId = $state<string | null>(null);
  const selectedNode = $derived(NODES.find((n) => n.id === selectedId) ?? null);

  function toggleNode(id: string) {
    selectedId = selectedId === id ? null : id;
  }

  function handleKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleNode(id);
    }
  }
</script>

<div class="flex flex-col gap-6">
  <div
    class="overflow-x-auto rounded-xl border border-[var(--color-console-line)] bg-[var(--color-console-surface)] p-4"
  >
    <svg
      viewBox="0 0 640 380"
      role="img"
      aria-label="Architecture diagram: Astro Islands and CI feed the Agent Loop, which calls RAG and the Rate Limiter"
      class="mx-auto h-auto w-full min-w-[560px] max-w-[640px]"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--color-console-text-dim)" />
        </marker>
      </defs>

      <!-- Connections (drawn first, under the nodes) -->
      <path
        d="M420,50 L460,50"
        stroke="var(--color-console-text-dim)"
        stroke-width="1.5"
        stroke-dasharray="4 4"
        fill="none"
        marker-end="url(#arrowhead)"
      />
      <path
        d="M320,80 L320,150"
        stroke="var(--color-console-text-dim)"
        stroke-width="1.5"
        fill="none"
        marker-end="url(#arrowhead)"
      />
      <path
        d="M280,214 L150,290"
        stroke="var(--color-console-text-dim)"
        stroke-width="1.5"
        fill="none"
        marker-end="url(#arrowhead)"
      />
      <path
        d="M360,214 L480,290"
        stroke="var(--color-console-text-dim)"
        stroke-width="1.5"
        fill="none"
        marker-end="url(#arrowhead)"
      />

      <text
        x="430"
        y="12"
        text-anchor="middle"
        class="font-mono text-[10px]"
        fill="var(--color-console-text-dim)">builds &amp; verifies</text
      >
      <text
        x="330"
        y="118"
        class="font-mono text-[10px]"
        fill="var(--color-console-text-dim)">request</text
      >
      <text
        x="170"
        y="256"
        class="font-mono text-[10px]"
        fill="var(--color-console-text-dim)">query_jared_memory</text
      >
      <text
        x="400"
        y="256"
        class="font-mono text-[10px]"
        fill="var(--color-console-text-dim)">safeLimit()</text
      >

      <!-- Nodes -->
      {#each NODES as node (node.id)}
        {@const isSelected = selectedId === node.id}
        <g
          class="diagram-node cursor-pointer"
          role="button"
          tabindex="0"
          aria-pressed={isSelected}
          aria-label={`${node.title} — ${node.subtitle}. Show details.`}
          onclick={() => toggleNode(node.id)}
          onkeydown={(e) => handleKeydown(e, node.id)}
        >
          <rect
            x={node.x}
            y={node.y}
            width={node.w}
            height={node.h}
            rx="8"
            fill={isSelected
              ? 'var(--color-console-elev)'
              : 'var(--color-console-surface)'}
            stroke={isSelected
              ? 'var(--color-console-signal-strong)'
              : 'var(--color-console-line)'}
            stroke-width={isSelected ? 2 : 1.5}
          />
          <text
            x={node.x + node.w / 2}
            y={node.y + node.h / 2 - 4}
            text-anchor="middle"
            class="font-mono text-[13px] font-semibold"
            fill="var(--color-console-text)">{node.title}</text
          >
          <text
            x={node.x + node.w / 2}
            y={node.y + node.h / 2 + 14}
            text-anchor="middle"
            class="font-mono text-[10px]"
            fill="var(--color-console-signal)">{node.subtitle}</text
          >
        </g>
      {/each}
    </svg>
  </div>

  <p class="font-mono text-xs text-[var(--color-on-surface-muted)]">
    Click or focus + press Enter/Space on a node for details.
  </p>

  {#if selectedNode}
    <div
      class="rounded-xl border border-[var(--color-console-line)] bg-[var(--color-console-surface)] p-5"
      role="region"
      aria-label={`${selectedNode.title} details`}
    >
      <p
        class="font-mono text-sm font-semibold text-[var(--color-console-signal)]"
      >
        {selectedNode.title}
        <span class="text-[var(--color-console-text-dim)]"
          >— {selectedNode.subtitle}</span
        >
      </p>
      <p
        class="mt-3 font-mono text-[13px] leading-relaxed text-[var(--color-console-text)]"
      >
        {selectedNode.detail}
      </p>
    </div>
  {/if}
</div>

<style>
  .diagram-node:focus-visible {
    outline: 2px solid var(--color-console-signal);
    outline-offset: 2px;
  }
  .diagram-node rect {
    transition:
      fill 0.2s ease,
      stroke 0.2s ease;
  }
</style>
