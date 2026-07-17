// Pure, client-safe dmesg-style line builders shared by Loader.svelte (first
// visit) and DeckBootLog.svelte (first deck open). No node imports — do NOT
// import boot-data.ts here (see its doc comment for why); BootInfo comes
// from boot-info.ts instead.
import type { BootInfo } from './boot-info';

export interface DmesgLine {
  /** Pre-formatted `[ ssss.ffffff]` monotonic timestamp. */
  ts: string;
  /** Subsystem tag (rendered in console-warn amber); omitted for plain lines. */
  tag?: string;
  text: string;
}

interface RawLine {
  tag?: string;
  text: string;
}

/**
 * Formats a fake kernel-style monotonic timestamp: seconds right-padded to a
 * minimum field width of 4 with spaces, 6 fixed decimal places.
 * `[ {0,3}\d+\.\d{6}]` for any input — width only grows past 4 once the
 * whole-seconds part itself needs more digits.
 */
export function formatDmesgTimestamp(seconds: number): string {
  const [secPart, fracPart] = seconds.toFixed(6).split('.');
  return `[${(secPart ?? '0').padStart(4, ' ')}.${fracPart}]`;
}

function toLines(raw: RawLine[], offsetsSec: number[]): DmesgLine[] {
  return raw.map((line, i) => ({
    ts: formatDmesgTimestamp(
      offsetsSec[i] ?? offsetsSec[offsetsSec.length - 1] ?? 0,
    ),
    tag: line.tag,
    text: line.text,
  }));
}

// Deterministic, strictly-monotonic, non-linear offsets (clusters of close
// lines + longer "pause" jumps) — mirrors how a real boot log's timestamps
// bunch up around fast steps and stretch out around slow ones. No
// Math.random(): screenshots and e2e stay stable across runs.
const LOADER_OFFSETS_SEC = [
  // core
  0.001379, 0.001501, 0.001688, 0.001854, 0.002012,
  // vfs / content
  0.018233, 0.018457, 0.018789, 0.019344,
  // fonts
  0.064102, 0.064551,
  // router
  0.11248, 0.112733,
  // observers
  0.16809, 0.168312,
  // pagefind
  0.402117, 0.403568, 0.403912,
  // shell
  0.441205, 0.441633,
  // services
  0.790244, 0.791008, 0.791455, 0.792103, 0.792671,
  // islands
  1.20488, 1.205342, 1.205791, 1.206254, 1.206703, 1.207166, 1.207602, 1.208047,
  // theme
  1.480217, 1.480659,
  // scene
  1.721904, 1.722348, 1.72281,
  // deck
  2.051336, 2.051884,
  // agent
  2.38347, 2.384021,
  // finals
  2.612455, 2.834729,
];

const DECK_OFFSETS_SEC = [
  0.000892, 0.0413, 0.0419, 0.0424, 0.3187, 0.3192, 0.8045,
];

export function buildLoaderLines(bootInfo: BootInfo): DmesgLine[] {
  const raw: RawLine[] = [
    { text: `sheohn.os ${bootInfo.commitSha} — static build online` },
    { tag: 'build', text: `image assembled ${bootInfo.buildTimestamp}` },
    {
      tag: 'agent-core',
      text: `attached to firmware build ${bootInfo.commitSha}`,
    },
    { tag: 'pkg', text: `${bootInfo.dependencyCount} dependencies resolved` },
    { text: 'Astro 6 · Svelte 5 · Tailwind v4' },
    { tag: 'vfs', text: 'mounted rootfs (astro static output)' },
    {
      tag: 'vfs',
      text: 'mounted /projects — case-study volumes: crucible lexicon animo',
    },
    { tag: 'vfs', text: 'mounted ~/work (shell virtual filesystem)' },
    { tag: 'content', text: 'mdx collections validated against schema' },
    { tag: 'fonts', text: 'Inter 400/500/600/700 preloaded' },
    { tag: 'fonts', text: 'Playfair Display attached (swap)' },
    { tag: 'router', text: 'view transitions enabled (ClientRouter)' },
    { tag: 'router', text: 'astro:after-swap hooks registered' },
    { tag: 'observer', text: 'IntersectionObserver reveal rigs armed' },
    { tag: 'observer', text: 'hero visibility feed online' },
    { tag: 'pagefind', text: 'wasm module loaded' },
    { tag: 'pagefind', text: 'content index mapped' },
    { tag: 'shell', text: 'grep builtin wired to pagefind' },
    { tag: 'shell', text: 'builtins registered (cd ls cat grep trace clear)' },
    { tag: 'shell', text: 'history + tab completion online' },
    { tag: 'vector', text: 'upstash link established' },
    { tag: 'rag', text: 'embeddings at 1536 dims (gemini-embedding-001)' },
    { tag: 'ratelimit', text: 'sliding-window guards armed (upstash redis)' },
    { tag: 'mail', text: 'resend contact route standing by' },
    { tag: 'img', text: 'vercel image service negotiated' },
    { tag: 'svelte', text: 'islands hydrating (load / idle / visible)' },
    { tag: 'island', text: 'HeaderNav interactive' },
    { tag: 'island', text: 'CommandDeck docked' },
    { tag: 'island', text: 'ScenePilot on station' },
    { tag: 'island', text: 'ScrollProgress tracking' },
    { tag: 'island', text: 'CustomCursor calibrated' },
    { tag: 'island', text: 'ContactForm listening' },
    { tag: 'island', text: 'PongGame on standby' },
    { tag: 'theme', text: 'engine ready — light default, no OS sniff' },
    { tag: 'theme', text: 'whoosh transition primed' },
    { tag: 'scene', text: 'phosphor layers composited' },
    { tag: 'scene', text: 'dark-hero instrument primed' },
    { tag: 'scene', text: 'grid horizon locked' },
    { tag: 'deck', text: 'command palette + agent chat mounted' },
    { tag: 'deck', text: 'perch/dock glide calibrated' },
    { tag: 'agent-core', text: 'llm transport linked (gemini-3.1-flash-lite)' },
    { tag: 'agent-core', text: '6 tools registered' },
    { text: 'all subsystems nominal' },
    { text: 'sheohn.os: boot complete' },
  ];
  return toLines(raw, LOADER_OFFSETS_SEC);
}

export function buildDeckBootLines(bootInfo: BootInfo): DmesgLine[] {
  const raw: RawLine[] = [
    { text: 'sheohn.os deck boot' },
    {
      tag: 'agent-core',
      text: `attached to firmware build ${bootInfo.commitSha}`,
    },
    { tag: 'build', text: `image assembled ${bootInfo.buildTimestamp}` },
    { tag: 'pkg', text: `${bootInfo.dependencyCount} dependencies loaded` },
    { tag: 'vfs', text: 'deck panel mounted' },
  ];
  if (bootInfo.vectorCount !== undefined) {
    raw.push({
      tag: 'vector',
      text: `${bootInfo.vectorCount} vectors indexed`,
    });
  }
  raw.push({ tag: 'shell', text: 'ready' });
  return toLines(raw, DECK_OFFSETS_SEC);
}
