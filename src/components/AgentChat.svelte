<script lang="ts">
  import { Chat } from '@ai-sdk/svelte';
  import { setFocus } from '../store';

  let isMinimized = true;
  let messagesEndEl: HTMLDivElement | null = null;

  const chat = new Chat({
    api: '/api/chat',
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === 'trigger_ui_state') {
        const focus = toolCall.args?.focus ?? (toolCall as any).arguments?.focus;
        console.log(`AI triggered UI focus on: ${focus}`);
        setFocus(focus);
      }
    },
    onError: (err) => console.error('[AgentChat] error:', err),
  });

  let isLoading = false;
  $: isLoading = chat.status === 'streaming' || chat.status === 'submitted';

  $: if (chat.messages.length && messagesEndEl) {
    messagesEndEl.scrollIntoView({ behavior: 'smooth' });
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const trimmed = chat.input.trim();
    if (!trimmed) return;
    
    chat.append({ 
      role: 'user', 
      content: trimmed,
    });
    
    chat.input = '';
  }
</script>

<div>
  {#if isMinimized}
    <button
      data-cursor-green="true"
      class="fixed right-4 bottom-4 z-[999] flex cursor-pointer items-center gap-2 rounded-full border border-gray-800 bg-black/90 px-4 py-2 font-mono text-xs text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] backdrop-blur-md transition-all hover:bg-black/100"
      on:click={() => { console.log('Opening chat'); isMinimized = false; }}
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
      <div class="mb-4 flex items-center justify-between border-b border-gray-800 pb-2">
        <span class="flex items-center gap-2 font-mono text-xs text-green-500">
          <span class="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
          AGENT INTERFACE
          {#if isLoading}
            <span class="animate-pulse opacity-60">· thinking</span>
          {/if}
        </span>
        <button
          on:click={() => { console.log('Closing chat'); isMinimized = true; }}
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
        {#if chat.messages.length === 0}
          <p class="pt-20 text-center text-xs text-gray-600">
            [ awaiting query ]
          </p>
        {/if}
        
        {#each chat.messages as m (m.id)}
          {@const textContent = m.parts
            ? m.parts.filter((p) => p.type === 'text').map((p) => (p as any).text).join('')
            : m.content}
            
          <div class={m.role === 'user' ? 'text-green-400' : 'text-gray-300'}>
            <strong>{m.role === 'user' ? 'GUEST: ' : 'SYSTEM: '}</strong>
            {textContent}

            <!-- Tool executions -->
            {#if m.parts}
              {#each m.parts.filter((p) => p.type === 'tool-invocation') as p}
                <span class="mt-1 block text-xs text-yellow-500/70">
                  {'>'} {(p as any).toolInvocation?.toolName}({JSON.stringify((p as any).toolInvocation?.args)})
                </span>
              {/each}
            {/if}
          </div>
        {/each}
        <div bind:this={messagesEndEl}></div>
      </div>

      <form
        on:submit={handleSubmit}
        class="flex rounded border border-gray-800 bg-black"
      >
        <input
          class="flex-1 bg-transparent p-2 font-mono text-sm text-white focus:outline-none"
          bind:value={chat.input}
          placeholder="> query agent..."
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !chat.input.trim()}
          class="p-2 text-green-500 transition-colors hover:text-white disabled:opacity-30"
        >
          ↵
        </button>
      </form>
    </div>
  {/if}
</div>
