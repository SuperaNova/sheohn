<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { SvelteSet } from 'svelte/reactivity';

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
  import DeckShellOutput from './DeckShellOutput.svelte';
  import DeckBootLog from './DeckBootLog.svelte';
  import { execute } from '../../lib/shell/executor';
  import { complete } from '../../lib/shell/completion';
  import { getHistory, pushHistory } from '../../lib/shell/history';
  import { vfsRoot } from '../../lib/shell/vfs';
  import type { ShellCtx, ShellLogEntry } from '../../lib/shell/registry';
  import type { BootInfo } from '../../lib/boot-info';

  const SCENE_TARGETS = ['hero', 'about', 'stack', 'projects', 'contact'];

  // Boot info is computed at build time (src/lib/boot-data.ts, Astro
  // frontmatter only — see that file's doc comment) and handed down as a
  // plain serializable prop. Defaulted defensively so the component never
  // breaks if ever rendered without it (e.g. a future test harness).
  let {
    bootInfo = {
      commitSha: 'dev',
      buildTimestamp: new Date().toISOString(),
      dependencyCount: 0,
    },
  }: { bootInfo?: BootInfo } = $props();

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

  // ── Boot log (fake BIOS boot sequence, spec 02) ─────────────────────────
  // Plays once per browser session, the first time the deck expands. Gated
  // by a sessionStorage key distinct from Loader.svelte's 'loader-played' so
  // the two once-per-session animations don't collide.
  const BOOT_PLAYED_KEY = 'deck-boot-played';
  let showBootLog = $state(false);

  function completeBoot() {
    showBootLog = false;
  }

  // ── Shell state (pseudo-shell input router, src/lib/shell/) ─────────────
  let cwd = $state('/');
  let shellLog = $state<ShellLogEntry[]>([]);
  let shellHistory = $state<string[]>(getHistory());
  // What the visitor was typing before ArrowUp started browsing history —
  // restored once they arrow back past the most recent entry.
  let historyDraft = $state('');
  let historyCursor = $state<number | null>(null);
  let completionCandidates = $state<string[]>([]);

  // Clears the completion hint the moment the visitor types past a shown
  // suggestion (Tab-driven single-match completion sets inputValue itself
  // and clears candidates inline, so this only fires for manual typing).
  $effect(() => {
    void inputValue;
    completionCandidates = [];
  });

  // Keep local `expanded` in sync with the shared store (hero CTA, Cmd+K).
  $effect(() => {
    const open = $commandDeckOpen;
    untrack(() => {
      expanded = open;
      if (open) {
        queueMicrotask(() => inputEl?.focus());
        // First expand of the browser session: play the boot log instead of
        // the normal panel content. Subsequent opens (this tab, this
        // session) skip straight past it.
        if (
          !showBootLog &&
          typeof sessionStorage !== 'undefined' &&
          !sessionStorage.getItem(BOOT_PLAYED_KEY)
        ) {
          sessionStorage.setItem(BOOT_PLAYED_KEY, 'true');
          showBootLog = true;
        }
      }
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
    mode?: string;
  };

  // One handler per tool name — each validates its own args and no-ops on a
  // mismatch, so an unrecognized/malformed call is simply ignored.
  // open_case_study is NOT handled here: the tool *call* can carry a
  // hallucinated slug, so navigation waits for the server's validated result
  // (see the messages effect below).
  const toolCallHandlers: Record<string, (args: ToolCallArgs) => void> = {
    trigger_ui_state: (args) => {
      if (args.focus) setFocus(args.focus);
    },
    focus_section: (args) => {
      if (args.section && SCENE_TARGETS.includes(args.section)) {
        dispatchScene(args.section as SceneTarget);
      }
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

  // Navigate to a case study only once the server tool has validated the slug
  // (`status: 'opening'`) — navigating on the raw tool call would send the
  // visitor to a 404 when the model hallucinates a slug, even though the
  // server replies `not_found` so the model can correct itself in text.
  const handledCaseStudyCalls = new SvelteSet<string>();
  $effect(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type !== 'tool-open_case_study') continue;
        const p = part as {
          toolCallId: string;
          state: string;
          output?: { status?: string; slug?: string };
        };
        if (p.state !== 'output-available') continue;
        if (handledCaseStudyCalls.has(p.toolCallId)) continue;
        handledCaseStudyCalls.add(p.toolCallId);
        if (p.output?.status === 'opening' && p.output.slug) {
          dispatchRoute(`/projects/${p.output.slug}`);
        }
      }
    }
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

  // Injected into every shell command run — mirrors the store.ts calls the
  // original DeckCommand.run bodies made directly, so `home`/`theme`/`resume`
  // etc. behave identically whether typed bare or (still) via `/`.
  function buildShellCtx(): ShellCtx {
    return {
      cwd,
      vfs: vfsRoot,
      history: shellHistory,
      setCwd: (path) => {
        cwd = path;
      },
      navigate: goto,
      toggleTheme: () => toggleTheme(),
      openResume: () => window.open(personalInfo.resumeUrl, '_blank'),
      closeDeck: close,
      clearOutput: () => {
        shellLog = [];
      },
    };
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

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (commandMode) {
      filteredCommands[selectedIndex]?.run();
      return;
    }
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    completionCandidates = [];
    historyCursor = null;

    // Try the client-side shell first — deterministic commands resolve
    // instantly, offline. Anything the parser doesn't recognize as a known
    // command falls through to the LLM agent exactly as free text does today.
    const result = await execute(trimmed, buildShellCtx());
    if (result.recognized) {
      shellHistory = pushHistory(trimmed);
      // `clear` already emptied shellLog via ctx.clearOutput — don't
      // immediately re-append an entry for it.
      if (trimmed.split(/\s+/)[0] !== 'clear') {
        shellLog = [
          ...shellLog,
          {
            command: trimmed,
            lines: result.output.lines,
            error: !!result.output.error,
          },
        ];
      }
      inputValue = '';
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

  // Tab-completion (command names / vfs paths) and ArrowUp/ArrowDown history
  // recall for the shell — only reachable once there's non-'/', non-empty
  // input (starter-chip nav owns ArrowUp/Down while the input is empty).
  function onShellKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const cursor = inputEl?.selectionStart ?? inputValue.length;
      const result = complete(inputValue, cursor, vfsRoot, cwd);
      if (result.candidates.length === 1) {
        const candidate = result.candidates[0] ?? '';
        const before = inputValue.slice(0, result.replaceStart);
        const after = inputValue.slice(cursor);
        inputValue = before + candidate + after;
        const pos = before.length + candidate.length;
        queueMicrotask(() => inputEl?.setSelectionRange(pos, pos));
        completionCandidates = [];
      } else {
        completionCandidates = result.candidates;
      }
      return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    navigateHistory(e.key === 'ArrowUp' ? -1 : 1);
  }

  // -1 = older (ArrowUp), 1 = newer (ArrowDown). Mirrors a normal terminal:
  // walking past the newest entry restores whatever the visitor was typing.
  function navigateHistory(direction: -1 | 1) {
    if (!shellHistory.length) return;
    if (historyCursor === null) {
      if (direction !== -1) return;
      historyDraft = inputValue;
      historyCursor = shellHistory.length - 1;
      inputValue = shellHistory[historyCursor] ?? '';
      return;
    }
    const next = historyCursor + direction;
    if (next < 0) return;
    if (next >= shellHistory.length) {
      historyCursor = null;
      inputValue = historyDraft;
      return;
    }
    historyCursor = next;
    inputValue = shellHistory[next] ?? '';
  }

  function onInputKeydown(e: KeyboardEvent) {
    if (commandMode) {
      onCommandModeKeydown(e);
      return;
    }
    if (inputValue.trim() === '') {
      onStarterKeydown(e);
      return;
    }
    onShellKeydown(e);
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
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
      {#if showBootLog}
        <!-- Fake BIOS boot log (spec 02) — plays once per session, above the
             normal shell/chat surface, before falling through to it. -->
        <DeckBootLog {bootInfo} onComplete={completeBoot} />
      {:else}
        {#if shellLog.length}
          <!-- Shell command output — rendered alongside, not instead of, the
               LLM transcript below, so a mixed shell + chat session stays legible. -->
          <DeckShellOutput
            log={shellLog}
            maxHeightPx={listMaxPx ? Math.round(listMaxPx * 0.6) : undefined}
          />
        {/if}
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
          {@render starterChips(
            'border-t border-[var(--color-console-line)] p-3',
          )}
        {:else}
          <!-- Empty state: starter queries that each drive the page -->
          <div class="p-4 font-mono text-[13px]">
            <p class="text-[var(--color-console-text-dim)]">
              <span class="text-[var(--color-console-signal)]">system:</span>
              ask about Jared, or type
              <span class="text-[var(--color-console-signal)]">/</span> for commands.
            </p>
            {@render starterChips('mt-3')}
          </div>
        {/if}
      {/if}
    </div>
  {/if}

  {#snippet starterChips(wrapperClass: string)}
    <div class={wrapperClass}>
      <DeckStarterChips {starters} {starterIndex} showHint={true} onAsk={ask} />
    </div>
  {/snippet}

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

  {#if completionCandidates.length > 1}
    <!-- Ambiguous Tab-completion — multiple matches, nothing auto-filled. -->
    <div
      class="mt-1.5 truncate rounded-lg border border-[var(--color-console-line)] bg-[var(--color-console-surface)]/95 px-3 py-1 font-mono text-[11px] text-[var(--color-console-text-dim)] backdrop-blur-xl"
    >
      {completionCandidates.join('  ')}
    </div>
  {/if}
</aside>
