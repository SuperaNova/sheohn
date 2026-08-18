// Build-time-only module: computes real build/deploy facts for the command
// deck's boot log.
//
// CRITICAL: imports `node:child_process`, so it must never be reachable
// from client-shipped code — no .svelte file, not even type-only (use
// src/lib/boot-info.ts for the shared type). Call it from Astro frontmatter
// and pass the result down as a plain prop.
import { execSync } from 'node:child_process';
import pkg from '../../package.json' with { type: 'json' };
import type { BootInfo } from './boot-info';

export type { BootInfo };

/** Injectable knobs so tests never need a real git binary or env var. */
export interface BootInfoEnv {
  /** Stand-in for `import.meta.env.VERCEL_GIT_COMMIT_SHA`. */
  vercelGitCommitSha?: string;
  /** Stand-in for `execSync` — throw to simulate "no git binary". */
  exec?: (command: string) => string;
}

function resolveCommitSha(env: BootInfoEnv): string {
  if (env.vercelGitCommitSha) return env.vercelGitCommitSha;
  const exec =
    env.exec ?? ((command: string) => execSync(command, { encoding: 'utf8' }));
  try {
    const sha = exec('git rev-parse --short HEAD').trim();
    return sha || 'dev';
  } catch {
    // No git binary, no HEAD (shallow checkout), or any other failure —
    // this must never throw/block the build.
    return 'dev';
  }
}

function countDependencies(): number {
  const manifest = pkg as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return (
    Object.keys(manifest.dependencies ?? {}).length +
    Object.keys(manifest.devDependencies ?? {}).length
  );
}

/**
 * Computes the boot-log facts. Call this ONLY from Astro frontmatter
 * (build-time Node context) — never from a Svelte component or anything it
 * imports. `env` is for tests; production callers can omit it.
 */
export function getBootInfo(env: BootInfoEnv = {}): BootInfo {
  const vercelGitCommitSha =
    env.vercelGitCommitSha ??
    (import.meta.env.VERCEL_GIT_COMMIT_SHA as string | undefined);

  return {
    commitSha: resolveCommitSha({ vercelGitCommitSha, exec: env.exec }),
    buildTimestamp: new Date().toISOString(),
    dependencyCount: countDependencies(),
    // vectorCount intentionally omitted — see the BootInfo doc comment in
    // ./boot-info.ts. A live Upstash query at build time would both fail
    // against CI's stub credentials and is the wrong place for a network
    // call in a static build; a real count (if ever added) belongs behind a
    // request-time guard, not here.
  };
}
