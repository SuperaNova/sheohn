<script lang="ts">
  import { Chat } from '@ai-sdk/svelte';
  import { DefaultChatTransport } from 'ai';
  import { setFocus } from '../store';

  let { startMinimized = false } = $props();

  let isMinimized = $state(startMinimized);
  let chatError = $state('');
  let inputValue = $state('');
  let messagesEndEl = $state<HTMLDivElement | null>(null);

  let chat: Chat | null = null;
  try {
    chat = new Chat({
      transport: new DefaultChatTransport({ api: '/api/chat' }),
      onToolCall: ({ toolCall }) => {
        if (toolCall.toolName === 'trigger_ui_state') {
          const payload = toolCall as {
            args?: unknown;
            arguments?: unknown;
            input?: unknown;
          };
          const args = payload.args ?? payload.arguments ?? payload.input;
          const focus = (args as { focus?: string } | undefined)?.focus;
          if (focus) {
            console.log(`AI triggered UI focus on: ${focus}`);
            setFocus(focus);
          }
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

  $effect(() => {
    if (chat && chat.messages.length && messagesEndEl) {
      messagesEndEl.scrollIntoView({ behavior: 'smooth' });
    }
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

<div>
  {#if isMinimized}
    <button
      data-cursor-green="true"
      class="fixed right-4 bottom-4 z-[999] flex cursor-pointer items-center gap-2 rounded-full border border-gray-800 bg-black/90 px-4 py-2 font-mono text-xs text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] backdrop-blur-md transition-all hover:bg-black/100"
      onclick={() => {
        isMinimized = false;
      }}
      aria-label="Open System Agent"
    >
      <span class="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
      [ + ] SYSTEM AGENT
    </button>
  {:else}
    <div
      data-cursor-green="true"
      class="fixed right-4 bottom-4 z-[999] w-96 rounded-xl border border-gray-800 bg-black/90 p-4 shadow-2xl backdrop-blur-md"
    >
      <div
        class="mb-4 flex items-center justify-between border-b border-gray-800 pb-2"
      >
        <span class="flex items-center gap-2 font-mono text-xs text-green-500">
          <span class="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
          AGENT INTERFACE
          {#if isLoading}
            <span class="animate-pulse opacity-60">· thinking</span>
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

      <div class="mb-4 h-64 space-y-2 overflow-y-auto pr-2 font-mono text-sm">
        {#if chatError}
          <div class="pt-10 text-center text-xs text-red-500">
            [ ERROR: {chatError} ]
          </div>
        {:else if !chat || chat.messages.length === 0}
          <div class="text-gray-300">
            <strong>SYSTEM: </strong> Ask me about Jared.
          </div>
        {/if}

        {#if chat}
          {#each chat.messages as m (m.id)}
            {@const textContent = m.parts
              ? m.parts
                  .filter((p) => p.type === 'text')
                  .map((p) => (p as { type: 'text'; text: string }).text)
                  .join('')
              : m.content || ''}

            <div class={m.role === 'user' ? 'text-green-400' : 'text-gray-300'}>
              <strong>{m.role === 'user' ? 'GUEST: ' : 'SYSTEM: '}</strong>
              {textContent}

              <!-- Tool executions -->
              {#if m.parts}
                {#each m.parts.filter((p) => p.type === 'tool-invocation') as p, i (i)}
                  <span class="mt-1 block text-xs text-yellow-500/70">
                    &gt; {(
                      p as {
                        toolInvocation?: { toolName: string; args: unknown };
                      }
                    ).toolInvocation?.toolName}({JSON.stringify(
                      (p as { toolInvocation?: { args: unknown } })
                        .toolInvocation?.args,
                    )})
                  </span>
                {/each}
              {/if}
            </div>
          {/each}
        {/if}
        <div bind:this={messagesEndEl}></div>
      </div>

      <form
        onsubmit={handleSubmit}
        class="flex rounded border border-gray-800 bg-black"
      >
        <input
          class="flex-1 bg-transparent p-2 font-mono text-sm text-white focus:outline-none"
          bind:value={inputValue}
          placeholder={chat ? '> query agent...' : '> error...'}
          disabled={isLoading || !chat}
        />
        <button
          type="submit"
          disabled={isLoading || !chat || !inputValue.trim()}
          class="p-2 text-green-500 transition-colors hover:text-white disabled:opacity-30"
        >
          ↵
        </button>
      </form>
    </div>
  {/if}
</div>
