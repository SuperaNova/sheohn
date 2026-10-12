// Type-only module shared by build-time boot-data.ts (node imports) and the client boot-log UI;
// safe to import anywhere.

/** Real build/deploy facts streamed as the deck's boot log. */
export interface BootInfo {
  /** Short commit SHA — Vercel env var, `git rev-parse --short HEAD`, or 'dev'. */
  commitSha: string;
  /** ISO timestamp captured at build/module-eval time. */
  buildTimestamp: string;
  /** `dependencies` + `devDependencies` key count from package.json. */
  dependencyCount: number;
  /** Upstash vector count; intentionally omitted (see boot-data.ts), optional for a future request-time count. */
  vectorCount?: number;
}
