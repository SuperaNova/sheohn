<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';

  import { Chat } from '@ai-sdk/svelte';
  import { DefaultChatTransport } from 'ai';
  import { navigate } from 'astro:transitions/client';
  import {
    setFocus,
    dispatchScene,
    dispatchRoute,
    toggleTheme,
    setTheme,
    commandDeckOpen,
    agentQuery,
    type SceneTarget,
  } from '../../store';
  import { personalInfo } from '../../data/personalInfo';
  import { starters } from '../../data/starters';
  import DeckCommandList from './DeckCommandList.svelte';
  import DeckChatLog from './DeckChatLog.svelte';
  import DeckStarterChips from './DeckStarterChips.svelte';

  const SCENE_TARGETS = ['hero', 'about', 'stack', 'projects', 'contact'];

  // ── Deterministic commands (the `/` namespace) ─────────────────────────────
  // Lifted from the former CommandPalette so navigation stays instant + offline.
  type DeckCommand = { name: string; label: string; run: () => void };
  const commands: DeckCommand[] = [
    { name: 'home', label: 'Go to home', run: () => goto('/') },
    { name: 'projects', label: 'Go to projects', run: () => goto('/projects') },
    { name: 'about', label: 'Go to about', run: () => goto('/about') },
    { name: 'contact', label: 'Go to contact', run: () => goto('/#contact') },
    { name: 'theme', label: 'Toggle dark / light', run: () => toggleTheme() },
    {
      name: 'resume',
      label: 'Open résumé (pdf)',
      run: () => window.open(personalInfo.resumeUrl, '_blank'),
    },
  ];

  let inputEl = $state<HTMLInputElement | null>(null);
  let deckRoot = $state<HTMLElement | null>(null);
  let inputValue = $state('');
  let selectedIndex = $state(0);
  // Highlighted recommended chip for keyboard (↑/↓) navigation; -1 = none.
  let starterIndex = $state(-1);
  let expanded = $state(false);
  let chatError = $state('');
  // One queued message: lets the visitor keep typing while a reply streams.
  let pending = $state<string | null>(null);
  // Platform-correct shortcut label; SSR-safe default, corrected on mount.
  let shortcut = $state('Ctrl K');
  // Keyboard-aware cap for the scrollable list. On mobile the on-screen
  // keyboard shrinks the *visual* viewport but not CSS vh/dvh, so an open
  // console would otherwise grow taller than the space above the keyboard and
  // ride up over the fixed site header. 0 until measured (SSR-safe → the
  // Tailwind max-h-72 fallback applies on the server / before hydration).
  let listMaxPx = $state(0);

  // Keep local `expanded` in sync with the shared store (hero CTA, Cmd+K).
  $effect(() => {
    const open = $commandDeckOpen;
    untrack(() => {
      expanded = open;
      if (open) queueMicrotask(() => inputEl?.focus());
    });
  });

  // ── Agent Interface (Vercel AI SDK Integration) ────────────────────────────
  // This chunk sets up the streaming connection to /api/chat.
  // It specifically hooks into `onToolCall` to intercept LLM function calls
  // (like `set_theme` or `focus_section`) and execute them locally using the Svelte stores
  // rather than letting the server handle them. This is how the AI physically "drives" the UI.
  type ToolCallArgs = {
    focus?: string;
    section?: string;
    slug?: string;
    mode?: string;
  };

  // One handler per tool name — each validates its own args and no-ops on a
  // mismatch, so an unrecognized/malformed call is simply ignored.
  const toolCallHandlers: Record<string, (args: ToolCallArgs) => void> = {
    trigger_ui_state: (args) => {
      if (args.focus) setFocus(args.focus);
    },
    focus_section: (args) => {
      if (args.section && SCENE_TARGETS.includes(args.section)) {
        dispatchScene(args.section as SceneTarget);
      }
    },
    open_case_study: (args) => {
      if (args.slug) dispatchRoute(`/projects/${args.slug}`);
    },
    set_theme: (args) => {
      if (args.mode === 'light' || args.mode === 'dark') setTheme(args.mode);
    },
    open_resume: () => window.open(personalInfo.resumeUrl, '_blank'),
  };

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
        const args = (payload.args ??
          payload.arguments ??
          payload.input ??
          {}) as ToolCallArgs;
        toolCallHandlers[payload.toolName]?.(args);
      },
      onError: (err) => console.error('[CommandDeck] agent error:', err),
    });
  } catch (err) {
    chatError = String(err);
    console.error('[CommandDeck] chat init failed', err);
  }

  const isLoading = $derived(
    chat ? chat.status === 'streaming' || chat.status === 'submitted' : false,
  );

  const messages = $derived(chat?.messages ?? []);
  const commandMode = $derived(inputValue.trimStart().startsWith('/'));

  const filteredCommands = $derived.by(() => {
    if (!commandMode) return [];
    const q = inputValue.trimStart().slice(1).toLowerCase();
    return commands.filter(
      (c) => c.name.includes(q) || c.label.toLowerCase().includes(q),
    );
  });

  $effect(() => {
    void filteredCommands;
    selectedIndex = 0;
  });

  $effect(() => {
    if (inputValue.trim() !== '') starterIndex = -1;
  });

  let wasLoading = false;
  $effect(() => {
    const loading = isLoading;
    untrack(() => {
      if (wasLoading && !loading && pending && chat) {
        const next = pending;
        pending = null;
        chat.sendMessage({ text: next });
      }
      wasLoading = loading;
    });
  });

  // Instant "working" pulse from the moment a message is sent, before the first
  // token streams back — makes the wait feel responsive even when the model is
  // still doing tool calls / RAG.
  const showTyping = $derived(
    isLoading &&
      (messages.length === 0 || messages[messages.length - 1]?.role === 'user'),
  );

  function open() {
    commandDeckOpen.set(true);
  }
  function close() {
    commandDeckOpen.set(false);
    inputEl?.blur();
  }

  function goto(path: string) {
    close();
    inputValue = '';
    navigate(path);
  }

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !chat) return;
    open();
    // Never drop the visitor's next thought while a reply is still streaming —
    // queue it and fire it the moment the agent is free again.
    if (isLoading) {
      pending = trimmed;
    } else {
      chat.sendMessage({ text: trimmed });
    }
    inputValue = '';
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (commandMode) {
      filteredCommands[selectedIndex]?.run();
      return;
    }
    ask(inputValue);
  }

  function onCommandModeKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % filteredCommands.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex =
        (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
    }
  }

  // Suggestion nav while the input is empty. The chips sit in a horizontal
  // row, so ←/→ are the primary axis; ↑/↓ are accepted too so it works
  // however the visitor reaches for it. Enter fires the highlighted chip.
  function onStarterKeydown(e: KeyboardEvent) {
    if (!starters.length) return;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const prev = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    if (next) {
      e.preventDefault();
      starterIndex = (starterIndex + 1) % starters.length;
    } else if (prev) {
      e.preventDefault();
      starterIndex = (starterIndex <= 0 ? starters.length : starterIndex) - 1;
    } else if (e.key === 'Enter' && starterIndex >= 0) {
      e.preventDefault();
      const starter = starters[starterIndex];
      if (starter) ask(starter.q);
      starterIndex = -1;
    }
  }

  function onInputKeydown(e: KeyboardEvent) {
    if (commandMode) {
      onCommandModeKeydown(e);
      return;
    }
    if (inputValue.trim() === '') onStarterKeydown(e);
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (expanded) close();
      else {
        open();
        inputEl?.focus();
      }
      return;
    }
    if (e.key === 'Escape' && expanded) close();
  }

  // Collapse when the visitor clicks anywhere outside the deck, so the panel
  // gets out of the way the moment they reach for the page behind it.
  function handleOutsidePointer(e: PointerEvent) {
    if (!expanded || !deckRoot) return;
    if (!deckRoot.contains(e.target as Node)) close();
  }

  onMount(() => {
    shortcut = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
      ? '⌘K'
      : 'Ctrl K';
    let lastTs = 0;
    const unsub = agentQuery.subscribe((q) => {
      if (q && q.ts !== lastTs) {
        lastTs = q.ts;
        ask(q.text);
      }
    });
    return unsub;
  });

  // Track the visual viewport so the list stays within the room above the
  // keyboard. ~270px is reserved for the input bar, panel header, chips row,
  // outer margins, and a gap that keeps the panel clear of the site header.
  // Capped to the 18rem (288px) desktop default and floored at a usable 120px.
  onMount(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const CHROME = 270;
    const measure = () => {
      listMaxPx = Math.min(288, Math.max(120, Math.round(vv.height - CHROME)));
      if (deckRoot) {
        const keyboardOffset = Math.max(
          0,
          window.innerHeight - vv.offsetTop - vv.height,
        );
        deckRoot.style.bottom =
          keyboardOffset > 20 ? `${keyboardOffset + 16}px` : '';
      }
    };
    measure();
    vv.addEventListener('resize', measure);
    vv.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    return () => {
      vv.removeEventListener('resize', measure);
      vv.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  });
</script>

<svelte:window
  onkeydown={handleWindowKeydown}
  onpointerdown={handleOutsidePointer}
/>

<aside
  bind:this={deckRoot}
  aria-label="Command Deck"
  data-cursor-green="true"
  class="fixed bottom-4 left-1/2 z-[120] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2"
>
  {#if expanded}
    <div
      transition:fly={{ y: 16, duration: 220 }}
      class="mb-2 overflow-hidden rounded-xl border border-[var(--color-console-line)] bg-[var(--color-console-surface)]/95 shadow-2xl backdrop-blur-xl"
    >
      <div
        class="flex items-center justify-between border-b border-[var(--color-console-line)] px-3 py-2"
      >
        <span
          class="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-[var(--color-console-signal)] uppercase"
        >
          <span
            class="h-1.5 w-1.5 rounded-full bg-[var(--color-console-signal)] {isLoading
              ? 'animate-pulse'
              : ''}"
          ></span>
          agent{isLoading ? ' · thinking' : ''}
        </span>
        <button
          type="button"
          onclick={close}
          aria-label="Collapse command deck"
          class="rounded px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-console-text-dim)] transition-colors hover:text-[var(--color-console-text)]"
          >esc</button
        >
      </div>
      {#if commandMode}
        <!-- Deterministic command palette -->
        <DeckCommandList
          commands={filteredCommands}
          {selectedIndex}
          {inputValue}
          maxHeightPx={listMaxPx}
          onHover={(i) => (selectedIndex = i)}
        />
      {:else if chatError}
        <div class="p-4 font-mono text-xs text-red-400">
          [ agent offline ] — slash-commands still work. Type
          <span class="text-[var(--color-console-signal)]">/</span> to list them.
        </div>
      {:else if messages.length}
        <!-- Agent conversation -->
        <DeckChatLog {messages} {showTyping} maxHeightPx={listMaxPx} />
        <!-- Persistent recommended commands — reachable after chatting too. -->
        <div class="border-t border-[var(--color-console-line)] p-3">
          <DeckStarterChips
            {starters}
            {starterIndex}
            showHint={true}
            onAsk={ask}
          />
        </div>
      {:else}
        <!-- Empty state: starter queries that each drive the page -->
        <div class="p-4 font-mono text-[13px]">
          <p class="text-[var(--color-console-text-dim)]">
            <span class="text-[var(--color-console-signal)]">system:</span> ask
            about Jared, or type
            <span class="text-[var(--color-console-signal)]">/</span> for commands.
          </p>
          <div class="mt-3">
            <DeckStarterChips
              {starters}
              {starterIndex}
              showHint={true}
              onAsk={ask}
            />
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- The persistent docked command bar -->
  <form
    onsubmit={handleSubmit}
    class="flex items-center gap-2 rounded-full border border-[var(--color-console-line)] bg-[var(--color-console-surface)]/95 px-4 py-2.5 shadow-[0_0_40px_rgba(74,222,128,0.15)] backdrop-blur-xl transition-all duration-500 focus-within:border-[var(--color-console-signal)]/50 focus-within:shadow-[0_0_50px_rgba(74,222,128,0.25)]"
  >
    <span
      class="font-mono text-sm text-[var(--color-console-signal)]"
      aria-hidden="true">›</span
    >
    <input
      id="command-deck-input"
      name="command-deck-input"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      bind:this={inputEl}
      bind:value={inputValue}
      onfocus={() => {
        if (!window.matchMedia('(pointer: coarse)').matches) open();
      }}
      onkeydown={onInputKeydown}
      role={commandMode ? 'combobox' : undefined}
      aria-expanded={commandMode ? expanded : undefined}
      aria-controls={commandMode ? 'deck-command-list' : undefined}
      aria-activedescendant={commandMode && filteredCommands.length
        ? `deck-cmd-${selectedIndex}`
        : undefined}
      aria-autocomplete={commandMode ? 'list' : undefined}
      class="min-w-0 flex-1 bg-transparent font-mono text-[16px] leading-tight text-[var(--color-console-text)] placeholder:text-[var(--color-console-text-dim)] focus:outline-none sm:text-sm"
      placeholder={pending
        ? 'queued — sends when the agent is free…'
        : 'type a command — or ask anything'}
      aria-label="Command deck — type a slash-command or ask about Jared"
    />
    {#if isLoading}
      <span class="font-mono text-[11px] text-[var(--color-console-signal)]/60"
        >thinking…</span
      >
    {/if}
    <kbd
      class="hidden rounded border border-[var(--color-console-line)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-console-text-dim)] sm:inline"
      >{shortcut}</kbd
    >
  </form>
</aside>
