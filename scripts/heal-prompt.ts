// Thin CLI: reads the failing eval run's per-case detail
// (data/eval-history/<date>.json), asks Gemini for a full replacement
// of src/lib/prompts.ts, validates the response, and writes it in place.
// Pure validation/prompt-building logic lives in src/lib/prompt-heal.ts so
// it's unit-testable without a live Gemini call.
//
// Usage: npx tsx scripts/heal-prompt.ts [path-to-eval-detail.json]
//   - Detail path defaults to data/eval-history/<index.json's latest.date>.json
//   - Requires GOOGLE_GENERATIVE_AI_API_KEY.
//   - On a valid candidate: overwrites src/lib/prompts.ts, writes
//     patched=true to $GITHUB_OUTPUT, exits 0.
//   - Benign no-op (no failing cases to heal, or the candidate is rejected
//     by validateCandidate): writes nothing, writes patched=false to
//     $GITHUB_OUTPUT, exits 0 — the workflow skips the re-eval.
//   - Real error (missing GOOGLE_GENERATIVE_AI_API_KEY, unreadable/missing
//     detail file, Gemini call throws): exits 1 so the job legitimately
//     fails. $GITHUB_OUTPUT writes are no-ops when that env var is unset.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  buildHealPrompt,
  enrichFailingCases,
  selectFailingCases,
  stripCodeFence,
  validateCandidate,
} from '../src/lib/prompt-heal';
import type { EvalHistoryIndex, EvalRunDetail } from '../src/lib/eval-history';
import { evalCases } from '../tests/eval/cases';
import { writeGithubOutput } from './lib/run-metadata';

const HISTORY_DIR =
  process.env.EVAL_HISTORY_DIR ?? path.join('data', 'eval-history');
const PROMPTS_PATH = path.join('src', 'lib', 'prompts.ts');

function resolveDetailPath(): string {
  const argPath = process.argv[2];
  if (argPath) return argPath;

  const indexPath = path.join(HISTORY_DIR, 'index.json');
  const index = JSON.parse(
    fs.readFileSync(indexPath, 'utf8'),
  ) as EvalHistoryIndex;
  if (!index.latest) {
    throw new Error(`no runs recorded in ${indexPath}`);
  }
  return path.join(HISTORY_DIR, `${index.latest.date}.json`);
}

async function main(): Promise<void> {
  const detailPath = resolveDetailPath();
  const detail = JSON.parse(
    fs.readFileSync(detailPath, 'utf8'),
  ) as EvalRunDetail;
  const failingCases = selectFailingCases(detail);

  if (failingCases.length === 0) {
    console.error(
      `[heal-prompt] ${detailPath} has no failing cases — nothing to heal.`,
    );
    writeGithubOutput({ patched: 'false' });
    process.exit(0);
  }

  const originalSource = fs.readFileSync(PROMPTS_PATH, 'utf8');
  const context = enrichFailingCases(failingCases, evalCases);
  const healPrompt = buildHealPrompt(originalSource, context);

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error('[heal-prompt] GOOGLE_GENERATIVE_AI_API_KEY is not set.');
    process.exit(1);
  }
  const google = createGoogleGenerativeAI({ apiKey });

  const { text } = await generateText({
    model: google('gemini-3.1-flash-lite'),
    prompt: healPrompt,
  });

  const candidate = stripCodeFence(text);
  const result = validateCandidate(candidate, originalSource);

  if (!result.valid) {
    console.error(`[heal-prompt] candidate rejected: ${result.reason}`);
    writeGithubOutput({ patched: 'false' });
    process.exit(0);
  }

  fs.writeFileSync(PROMPTS_PATH, candidate, 'utf8');
  console.log(`[heal-prompt] wrote a validated candidate to ${PROMPTS_PATH}`);
  console.log(
    `[heal-prompt] attempted to heal ${failingCases.length} failing case(s): ${failingCases
      .map((c) => c.name)
      .join(', ')}`,
  );
  writeGithubOutput({ patched: 'true' });
}

main().catch((err) => {
  console.error('[heal-prompt] fatal error:', err);
  process.exit(1);
});
