// Build-time-only: computes real build/deploy facts for the deck's boot log. Imports
// `node:child_process`, so never reach it from client code (use boot-info.ts for the type).
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
    // No git binary or HEAD (e.g. shallow checkout); must never block the build.
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

/** Computes the boot-log facts; call only from Astro frontmatter. `env` is for tests. */
export function getBootInfo(env: BootInfoEnv = {}): BootInfo {
  const vercelGitCommitSha =
    env.vercelGitCommitSha ??
    (import.meta.env.VERCEL_GIT_COMMIT_SHA as string | undefined);

  return {
    commitSha: resolveCommitSha({ vercelGitCommitSha, exec: env.exec }),
    buildTimestamp: new Date().toISOString(),
    dependencyCount: countDependencies(),
    // vectorCount omitted: a live Upstash query doesn't belong in a static build.
  };
}
