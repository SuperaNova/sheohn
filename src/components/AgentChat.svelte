<script lang="ts">
  let loaded = $state(false);
  let ChatPanel: any = $state(null);

  function loadAgent() {
    loaded = true;
    import('./AgentChatPanel.svelte').then((module) => {
      ChatPanel = module.default;
    });
  }
</script>

{#if !loaded}
  <button
    data-cursor-green="true"
    class="fixed right-4 bottom-4 z-[999] flex cursor-pointer items-center gap-2 rounded-full border border-gray-800 bg-black/90 px-4 py-2 font-mono text-xs text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] backdrop-blur-md transition-all hover:bg-black/100"
    onclick={loadAgent}
    aria-label="Open System Agent"
  >
    <span class="h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
    [ + ] SYSTEM AGENT
  </button>
{:else}
  {#if ChatPanel}
    <ChatPanel startMinimized={false} />
  {:else}
    <button
      class="fixed right-4 bottom-4 z-[999] flex cursor-wait items-center gap-2 rounded-full border border-gray-800 bg-black/90 px-4 py-2 font-mono text-xs text-green-500/70 backdrop-blur-md"
      aria-label="Loading Agent"
    >
      <span class="h-2 w-2 animate-pulse rounded-full bg-green-500/70"></span>
      LOADING CORE...
    </button>
  {/if}
{/if}
