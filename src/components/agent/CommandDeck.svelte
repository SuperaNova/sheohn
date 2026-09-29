<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { SvelteSet } from 'svelte/reactivity';
  import { get } from 'svelte/store';

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
    lastRagTrace,
    theme,
    heroInView,
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
  import { formatRagTrace, type RagQueryResult } from '../../lib/rag';
  import { prefersReducedMotion } from '../../lib/motion';

  const SCENE_TARGETS = ['hero', 'about', 'stack', 'projects', 'contact'];

  // Boot info is built at build time (src/lib/boot-data.ts); defaulted so the deck renders without it.
  let {
    bootInfo = {
      commitSha: 'dev',
      buildTimestamp: new Date().toISOString(),
      dependencyCount: 0,
    },
  }: { bootInfo?: BootInfo } = $props();

  // Deterministic `/` commands: instant and offline.
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
    {
      name: 'trace',
      label: 'Replay last RAG retrieval trace',
      run: () => runTrace(),
    },
  ];

  let inputEl = $state<HTMLInputElement | null>(null);
  let deckRoot = $state<HTMLElement | null>(null);

  // Perched posture: the collapsed deck stands on the dark hero's horizon and glides to the
  // bottom-centre dock on scroll. Desktop-only.
  let isLg = $state(false);
  $effect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => (isLg = mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  });
  let inputValue = $state('');
  let selectedIndex = $state(0);
  // Highlighted recommended chip for keyboard (↑/↓) navigation; -1 = none.
  let starterIndex = $state(-1);
  let expanded = $state(false);
  // Opening from the perch delays the panel fly-in until the bar docks; closing delays
  // re-perching until the panel flies out.
  const PANEL_GLIDE_DELAY_MS = 600;
  const REPERCH_DELAY_MS = 250;
  let openedFromPerch = $state(false);
  let reperchHold = $state(false);
  let reperchTimer: ReturnType<typeof setTimeout> | undefined;
  const perched = $derived(
    $theme === 'dark' && $heroInView && !expanded && isLg && !reperchHold,
  );
  // The "power on" chip is pointless once the site is already dark.
  const visibleStarters = $derived(
    starters.filter((s) => !s.hideWhenDark || $theme !== 'dark'),
  );
  let chatError = $state('');
  // One queued message: lets the visitor keep typing while a reply streams.
  let pending = $state<string | null>(null);
  // Platform-correct shortcut label; SSR-safe default, corrected on mount.
  let shortcut = $state('Ctrl K');
  // Cap for the scrollable list: the mobile keyboard shrinks the visual viewport but not vh/dvh.
  // 0 until measured (SSR falls back to max-h-72).
  let listMaxPx = $state(0);

  // Boot log plays once per session on first expand; key differs from Loader's 'loader-played'.
  const BOOT_PLAYED_KEY = 'deck-boot-played';
  let showBootLog = $state(false);

  function completeBoot() {
    showBootLog = false;
  }

  // Shell input router state.
  let cwd = $state('/');
  let shellLog = $state<ShellLogEntry[]>([]);
  let shellHistory = $state<string[]>(getHistory());
  // Draft typed before ArrowUp history browsing; restored past the newest entry.
  let historyDraft = $state('');
  let historyCursor = $state<number | null>(null);
  let completionCandidates = $state<string[]>([]);

  // Clears the completion hint once the visitor types past it.
  $effect(() => {
    void inputValue;
    completionCandidates = [];
  });

  // Keep local `expanded` in sync with the shared store (hero CTA, Cmd+K).
  $effect(() => {
    const open = $commandDeckOpen;
    untrack(() => {
      const wasExpanded = expanded;
      expanded = open;
      clearTimeout(reperchTimer);

      if (open) {
        // Delay the panel fly-in only when just perched; docked opens stay snappy.
        openedFromPerch =
          !prefersReducedMotion() && $theme === 'dark' && $heroInView && isLg;
        reperchHold = false;
        queueMicrotask(() => inputEl?.focus());
        // First expand this session plays the boot log.
        if (
          !showBootLog &&
          typeof sessionStorage !== 'undefined' &&
          !sessionStorage.getItem(BOOT_PLAYED_KEY)
        ) {
          sessionStorage.setItem(BOOT_PLAYED_KEY, 'true');
          showBootLog = true;
        }
        return;
      }

      // Closing: hold re-perch until the panel fly-out clears the dock.
      if (
        wasExpanded &&
        !prefersReducedMotion() &&
        $theme === 'dark' &&
        $heroInView &&
        isLg
      ) {
        reperchHold = true;
        reperchTimer = setTimeout(() => {
          reperchHold = false;
        }, REPERCH_DELAY_MS);
      }
    });
  });

  // Streams from /api/chat; onToolCall runs UI tools (set_theme, focus_section) locally via stores.
  type ToolCallArgs = {
    focus?: string;
    section?: string;
    mode?: string;
  };

  // Per-tool handlers ignore malformed calls. open_case_study waits for the server's validated
  // result (messages effect below) since the call may carry a hallucinated slug.
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

  // Navigate only after the server validates the slug (`status: 'opening'`); a hallucinated slug would 404.
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

  // Capture the latest query_jared_memory result for `/trace`.
  const handledRagCalls = new SvelteSet<string>();
  $effect(() => {
    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type !== 'tool-query_jared_memory') continue;
        const p = part as {
          toolCallId: string;
          state: string;
          output?: RagQueryResult;
        };
        if (p.state !== 'output-available') continue;
        if (handledRagCalls.has(p.toolCallId)) continue;
        handledRagCalls.add(p.toolCallId);
        if (p.output) lastRagTrace.set(p.output);
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

  // Immediate pulse on send, before the first token streams.
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

  // Context injected into every shell command.
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
      getLastRagTrace: () => get(lastRagTrace),
    };
  }

  // `/trace` fallback for `/`-prefixed dispatch; shares formatRagTrace with the bare builtin.
  function runTrace() {
    shellLog = [
      ...shellLog,
      {
        command: '/trace',
        lines: formatRagTrace(get(lastRagTrace)),
        error: false,
      },
    ];
    inputValue = '';
  }

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !chat) return;
    open();
    // Queue input while a reply streams; send when the agent is free.
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

    // Shell first (instant, offline); unrecognized input falls through to the agent.
    const result = await execute(trimmed, buildShellCtx());
    if (result.recognized) {
      shellHistory = pushHistory(trimmed);
      // `clear` already emptied shellLog; don't re-append.
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

  // Chip nav while input is empty: left/right primary, up/down also accepted; Enter fires the highlighted chip.
  function onStarterKeydown(e: KeyboardEvent) {
    const chips = visibleStarters;
    if (!chips.length) return;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const prev = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    if (next) {
      e.preventDefault();
      starterIndex = (starterIndex + 1) % chips.length;
    } else if (prev) {
      e.preventDefault();
      starterIndex = (starterIndex <= 0 ? chips.length : starterIndex) - 1;
    } else if (e.key === 'Enter' && starterIndex >= 0) {
      e.preventDefault();
      const starter = chips[starterIndex];
      if (starter) ask(starter.q);
      starterIndex = -1;
    }
  }

  // Shell Tab-completion and history recall; starter-chip nav owns ArrowUp/Down while input is empty.
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

  // -1 = older (ArrowUp), 1 = newer; past the newest restores the draft.
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

  // Collapse on outside click.
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

  // Keep the list within the room above the keyboard: ~270px reserved for chrome,
  // capped at 18rem, floored at 120px.
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
  class="deck-root fixed bottom-4 left-1/2 z-[120] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2"
  class:deck-perched={perched}
>
  {#if expanded}
    <div
      in:fly={{
        y: 16,
        duration: 220,
        delay: openedFromPerch ? PANEL_GLIDE_DELAY_MS : 0,
      }}
      out:fly={{ y: 16, duration: 220 }}
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
        <!-- Boot log plays once per session before the shell/chat surface. -->
        <DeckBootLog {bootInfo} onComplete={completeBoot} />
      {:else}
        {#if shellLog.length}
          <!-- Shell output renders alongside the chat transcript. -->
          <DeckShellOutput
            log={shellLog}
            maxHeightPx={listMaxPx ? Math.round(listMaxPx * 0.6) : undefined}
          />
        {/if}
        {#if commandMode}
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
          <DeckChatLog {messages} {showTyping} maxHeightPx={listMaxPx} />
          <!-- Recommended commands stay reachable after chatting. -->
          {@render starterChips(
            'border-t border-[var(--color-console-line)] p-3',
          )}
        {:else}
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
      <DeckStarterChips
        starters={visibleStarters}
        {starterIndex}
        showHint={true}
        onAsk={ask}
      />
    </div>
  {/snippet}

  <!-- Perched readout: collapses when docked; decorative build data. -->
  <div class="deck-readout" aria-hidden="true">
    <p class="deck-readout-head">
      <span class="deck-readout-pulse"></span>
      sheohn·os — field unit
    </p>
    <p><span class="deck-ok">[ok]</span> build {bootInfo.commitSha} · vercel</p>
    <p>
      <span class="deck-ok">[ok]</span>
      {bootInfo.dependencyCount} deps · rag online
    </p>
    <p class="deck-dim">agent: idle<span class="deck-cursor">▌</span></p>
  </div>

  <form
    onsubmit={handleSubmit}
    class="deck-bar flex items-center gap-2 rounded-full border border-[var(--color-console-line)] bg-[var(--color-console-surface)]/95 px-4 py-2.5 shadow-[0_0_40px_rgba(74,222,128,0.15)] backdrop-blur-xl transition-all duration-500 focus-within:border-[var(--color-console-signal)]/50 focus-within:shadow-[0_0_50px_rgba(74,222,128,0.25)]"
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
    <!-- Ambiguous completion: multiple matches, nothing auto-filled. -->
    <div
      class="mt-1.5 truncate rounded-lg border border-[var(--color-console-line)] bg-[var(--color-console-surface)]/95 px-3 py-1 font-mono text-[11px] text-[var(--color-console-text-dim)] backdrop-blur-xl"
    >
      {completionCandidates.join('  ')}
    </div>
  {/if}
</aside>

<style>
  /* Readout lines hidden while docked; perch rules reveal them. */
  .deck-readout {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    padding: 0 1.1rem;
    font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
    font-size: 0.72rem;
    line-height: 1.9;
    color: var(--color-console-text);
    transition:
      max-height 0.45s ease,
      opacity 0.3s ease,
      padding 0.45s ease;
  }

  .deck-readout-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-size: 0.62rem;
    color: var(--color-console-signal);
    margin-bottom: 0.35rem;
  }

  .deck-readout-pulse {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 999px;
    background: var(--color-console-signal);
  }

  .deck-ok {
    color: var(--color-console-signal);
  }

  .deck-dim {
    color: var(--color-console-text-dim);
  }

  @media (prefers-reduced-motion: no-preference) {
    .deck-readout-pulse {
      animation: deck-pulse 2.2s ease-in-out infinite;
    }
    .deck-cursor {
      animation: deck-blink 1.1s steps(2, start) infinite;
    }
  }

  @keyframes deck-pulse {
    50% {
      opacity: 0.35;
    }
  }

  @keyframes deck-blink {
    50% {
      opacity: 0;
    }
  }

  /* Glide is desktop dark-hero only; on the lg+ rule so the mobile keyboard offset never animates. */
  @media (min-width: 1024px) {
    :global(html.dark) .deck-root {
      transition:
        left 0.65s cubic-bezier(0.22, 1, 0.36, 1),
        bottom 0.65s cubic-bezier(0.22, 1, 0.36, 1),
        width 0.65s cubic-bezier(0.22, 1, 0.36, 1),
        translate 0.65s cubic-bezier(0.22, 1, 0.36, 1);
    }

    /* Cancel the `translate` centering (not `transform`) when perched. */
    :global(html.dark) .deck-root.deck-perched {
      left: calc(100vw - var(--scene-perch-width) - var(--scene-perch-right));
      bottom: var(--scene-perch-bottom);
      width: var(--scene-perch-width);
      translate: 0;
    }

    :global(html.dark) .deck-perched .deck-readout {
      max-height: 10rem;
      opacity: 1;
      padding: 0.8rem 1.1rem 0.4rem;
    }

    /* Perched: the aside carries the panel chrome, the form drops its own. */
    :global(html.dark) .deck-perched {
      border: 1px solid var(--color-console-line);
      border-radius: 12px;
      background: color-mix(
        in srgb,
        var(--color-console-surface) 95%,
        transparent
      );
      backdrop-filter: blur(12px);
      box-shadow: 0 0 40px rgba(74, 222, 128, 0.12);
    }

    :global(html.dark) .deck-perched .deck-bar {
      border-color: transparent;
      background: transparent;
      box-shadow: none;
      backdrop-filter: none;
      padding-top: 0.35rem;
      padding-bottom: 0.7rem;
    }

    /* Console-line type size while perched so the placeholder fits. */
    :global(html.dark) .deck-perched .deck-bar input,
    :global(html.dark) .deck-perched .deck-bar span {
      font-size: 0.72rem;
    }

    /* Landing shadow: the console stands on the grid. */
    .deck-root::after {
      content: '';
      position: absolute;
      left: 6%;
      right: 6%;
      bottom: -16px;
      height: 24px;
      background: radial-gradient(
        ellipse 50% 50% at 50% 50%,
        rgba(3, 8, 5, 0.85),
        transparent 70%
      );
      z-index: -1;
      opacity: 0;
      transition: opacity 0.4s ease;
      pointer-events: none;
    }

    :global(html.dark) .deck-perched::after {
      opacity: 1;
    }
  }
</style>
