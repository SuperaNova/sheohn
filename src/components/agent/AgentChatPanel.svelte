<script lang="ts">
  import { untrack } from 'svelte';
  import { Chat } from '@ai-sdk/svelte';
  import { DefaultChatTransport } from 'ai';
  import {
    setFocus,
    dispatchScene,
    dispatchRoute,
    type SceneTarget,
  } from '../../store';

  const SCENE_TARGETS = ['hero', 'about', 'stack', 'projects', 'contact'];

  let { startMinimized = false } = $props();

  let isMinimized = $state(untrack(() => startMinimized));
  let chatError = $state('');
  let inputValue = $state('');
  let listEl = $state<HTMLDivElement | null>(null);

  let chat = $state<Chat | null>(null);
  try {
    chat = new Chat({
      transport: new DefaultChatTransport({ api: '/api/chat' }),
      onToolCall: ({ toolCall }) => {
        const payload = toolCall as {
          toolName: string;
          args?: unknown;
          arguments?: unknown;
          input?: unknown;
        };
        const args = (payload.args ?? payload.arguments ?? payload.input) as
          | { focus?: string; section?: string; slug?: string }
          | undefined;

        if (payload.toolName === 'trigger_ui_state' && args?.focus) {
          setFocus(args.focus);
        } else if (
          payload.toolName === 'focus_section' &&
          args?.section &&
          SCENE_TARGETS.includes(args.section)
        ) {
          dispatchScene(args.section as SceneTarget);
        } else if (payload.toolName === 'open_case_study' && args?.slug) {
          dispatchRoute(`/projects/${args.slug}`);
        }
      },
      onError: (err) => console.error('[AgentChat] error:', err),
    });
  } catch (err) {
    chatError = String(err);
    console.error('Chat init failed', err);
  }

  const isLoading = $derived(
    chat ? chat.status === 'streaming' || chat.status === 'submitted' : false,
  );

  // Grows as tokens stream in, so the autoscroll effect keeps firing.
  const streamTick = $derived.by(() => {
    if (!chat || !chat.messages.length) return 0;
    return chat.messages.reduce((n, m) => {
      if (!m.parts) return n + (m.content?.length ?? 0);
      return (
        n +
        m.parts.reduce(
          (t, p) =>
            t + (p.type === 'text' ? (p as { text: string }).text.length : 0),
          0,
        )
      );
    }, 0);
  });

  // Keep the list pinned to the bottom by scrolling the container itself —
  // scrollIntoView would scroll the whole page and fight the agent's panning.
  $effect(() => {
    void streamTick;
    void chat?.messages.length;
    const el = listEl;
    if (el) el.scrollTop = el.scrollHeight;
  });

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!chat) return;
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    chat.sendMessage({ text: trimmed });
    inputValue = '';
  }
</script>

{#if isMinimized}
  <button
    data-cursor-green="true"
    class="fixed right-4 bottom-4 z-[999] flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-black/90 px-4 py-2 font-mono text-xs text-green-400 shadow-[0_0_18px_rgba(34,197,94,0.28)] backdrop-blur-md transition-all hover:border-green-500/40"
    onclick={() => {
      isMinimized = false;
    }}
    aria-label="Open System Agent"
  >
    <span class="h-2 w-2 animate-pulse rounded-full bg-green-400"></span>
    [ + ] SYSTEM AGENT
  </button>
{:else}
  <div
    data-cursor-green="true"
    class="fixed right-4 bottom-4 z-[999] flex w-96 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur-xl"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-white/10 px-4 py-3"
    >
      <span class="flex items-center gap-2 font-mono text-xs text-green-400">
        <span class="h-2 w-2 animate-pulse rounded-full bg-green-400"></span>
        AGENT INTERFACE
        {#if isLoading}
          <span class="text-green-400/50">· thinking</span>
        {/if}
      </span>
      <button
        onclick={() => {
          isMinimized = true;
        }}
        class="text-gray-500 transition-colors hover:text-white"
        aria-label="Minimize System Agent"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M5 12h14" />
        </svg>
      </button>
    </div>

    <!-- Messages -->
    <div
      bind:this={listEl}
      class="agent-scroll flex h-80 flex-col gap-4 overflow-y-auto px-4 py-4 font-mono text-[13px] leading-relaxed"
    >
      {#if chatError}
        <p class="my-auto text-center text-xs text-red-400">
          [ ERROR: {chatError} ]
        </p>
      {:else if !chat || chat.messages.length === 0}
        <p class="text-gray-500">
          <span class="text-green-400">system:</span> ask me anything about Jared
          — his background, stack, or work.
        </p>
      {/if}

      {#if chat}
        {#each chat.messages as m (m.id)}
          <div class="flex flex-col gap-1">
            <span
              class="text-[10px] tracking-[0.18em] uppercase {m.role === 'user'
                ? 'text-green-400/70'
                : 'text-gray-500'}"
            >
              {m.role === 'user' ? 'guest' : 'system'}
            </span>

            <div class="break-words text-gray-200">
              {#if m.parts}
                {#each m.parts as p, i (i)}
                  {#if p.type === 'text'}
                    <span>{(p as { type: 'text'; text: string }).text}</span>
                  {:else if typeof p.type === 'string' && (p.type.startsWith('tool-') || p.type === 'dynamic-tool')}
                    {@const part = p as {
                      type: string;
                      toolName?: string;
                      input?: unknown;
                    }}
                    {@const toolName =
                      part.toolName ?? part.type.replace(/^tool-/, '')}
                    <span
                      class="mt-1 block font-mono text-[11px] break-all text-green-500/55"
                    >
                      › {toolName}({JSON.stringify(part.input)})
                    </span>
                  {/if}
                {/each}
              {:else}
                {m.content || ''}
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Composer -->
    <form
      onsubmit={handleSubmit}
      class="flex items-center gap-2 border-t border-white/10 px-3 py-3"
    >
      <span class="font-mono text-sm text-green-400/70" aria-hidden="true"
        >›</span
      >
      <input
        class="min-w-0 flex-1 bg-transparent font-mono text-sm text-white placeholder:text-gray-600 focus:outline-none"
        bind:value={inputValue}
        placeholder={chat ? 'query agent…' : 'error…'}
        disabled={isLoading || !chat}
      />
      <button
        type="submit"
        disabled={isLoading || !chat || !inputValue.trim()}
        class="rounded-md px-2 py-1 font-mono text-green-400 transition-colors hover:bg-green-400/10 hover:text-green-300 disabled:opacity-25 disabled:hover:bg-transparent"
        aria-label="Send message"
      >
        ↵
      </button>
    </form>
  </div>
{/if}

<style>
  /* Slim, on-brand scrollbar for the message list. */
  .agent-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(34, 197, 94, 0.35) transparent;
  }
  .agent-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .agent-scroll::-webkit-scrollbar-thumb {
    background: rgba(34, 197, 94, 0.3);
    border-radius: 9999px;
  }
  .agent-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(34, 197, 94, 0.5);
  }
</style>
