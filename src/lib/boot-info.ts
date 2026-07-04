// Pure type definitions shared between the build-time boot-data module
// (src/lib/boot-data.ts, which pulls in node:child_process and must never be
// imported by client-shipped code) and the client-side deck boot-log UI
// (DeckBootLog.svelte / CommandDeck.svelte). This file has zero runtime code
// and zero Node-only imports, so it's safe to import from anywhere.

/** Real build/deploy facts streamed as the deck's boot log (spec 02). */
export interface BootInfo {
  /** Short commit SHA — Vercel env var, `git rev-parse --short HEAD`, or 'dev'. */
  commitSha: string;
  /** ISO timestamp captured at build/module-eval time. */
  buildTimestamp: string;
  /** `dependencies` + `devDependencies` key count from package.json. */
  dependencyCount: number;
  /**
   * Vector count from the Upstash index — intentionally omitted for v1 (see
   * src/lib/boot-data.ts for why). Left optional/typed so a future spec can
   * wire a real request-time count without changing this shape.
   */
  vectorCount?: number;
}
