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
  0.001379, 0.001522, 0.00178, 0.04521, 0.04598, 0.0464, 0.3125, 0.3131, 0.3137,
  0.3142, 0.8023, 0.8029, 0.8034, 1.4021, 1.4027, 2.214053, 2.2146,
];

const DECK_OFFSETS_SEC = [
  0.000892, 0.0413, 0.0419, 0.0424, 0.3187, 0.3192, 0.8045,
];

export function buildLoaderLines(bootInfo: BootInfo): DmesgLine[] {
  const raw: RawLine[] = [
    { text: `sheohn.os ${bootInfo.commitSha} — static build online` },
    { tag: 'vfs', text: 'mounted rootfs (astro static output)' },
    { tag: 'pkg', text: `${bootInfo.dependencyCount} dependencies resolved` },
    {
      tag: 'agent-core',
      text: `attached to firmware build ${bootInfo.commitSha}`,
    },
    { tag: 'build', text: `image assembled ${bootInfo.buildTimestamp}` },
    { text: 'Astro 6 · Svelte 5 · Tailwind v4' },
    { tag: 'shell', text: 'builtins registered (cd ls cat grep trace clear)' },
    { tag: 'pagefind', text: 'content index loaded' },
    { tag: 'vector', text: 'upstash link established' },
    { tag: 'ratelimit', text: 'sliding-window guards armed' },
    { tag: 'theme', text: 'engine ready — light default, no OS sniff' },
    { tag: 'svelte', text: 'islands hydrating' },
    { text: 'scene control online' },
    { tag: 'scene', text: 'dark-hero instrument primed' },
    { tag: 'deck', text: 'command palette + agent chat mounted' },
    { tag: 'agent-core', text: 'llm transport linked' },
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
