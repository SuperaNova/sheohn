// Pure logic for the self-healing prompt bot; scripts/heal-prompt.ts and
// scripts/compare-eval-runs.ts wrap it. Lives under src/ so vitest's
// `src/**` include glob covers it. The Gemini call itself stays in the
// script — not unit-testable here without mocking the SDK.
import type { EvalCaseResult, EvalRunDetail } from './eval-history';
import { summarizeCases } from './eval-history';

const REQUIRED_EXPORT = 'export const SYSTEM_PROMPT';
const REQUIRED_IMPORT = "import { personalInfo } from '../data/personalInfo';";

// The real file's body is well over 1KB; anything drastically shorter is
// almost certainly a truncated or empty model response.
const MIN_CANDIDATE_LENGTH = 400;

// Phrases that indicate the model refused or emitted a placeholder instead
// of a real replacement file.
const REFUSAL_PATTERNS = [
  /\bi cannot\b/i,
  /\bi can.?t (help|assist|comply)/i,
  /as an ai language model/i,
  /\bi'm (not able|unable) to\b/i,
  /\[\s*(placeholder|todo|your code here)\s*\]/i,
];

export type CandidateValidation =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Strips a markdown code fence Gemini sometimes wraps the file in
 * (```ts / ```typescript ... ```), returning the inner source. Content
 * without a fence is returned trimmed and unchanged.
 */
export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = /^```[a-z]*\n([\s\S]*?)\n?```$/i.exec(trimmed);
  return fenceMatch ? fenceMatch[1]!.trim() : trimmed;
}

/**
 * Validates a candidate prompts.ts replacement before it's ever written to
 * disk. Rejects anything that isn't a plausible, meaningfully different
 * replacement of the original file.
 */
export function validateCandidate(
  candidate: string,
  original: string,
): CandidateValidation {
  const trimmedCandidate = candidate.trim();

  if (!candidate.includes(REQUIRED_EXPORT)) {
    return { valid: false, reason: `missing "${REQUIRED_EXPORT}"` };
  }
  if (!candidate.includes(REQUIRED_IMPORT)) {
    return { valid: false, reason: `missing import "${REQUIRED_IMPORT}"` };
  }
  if (trimmedCandidate.length < MIN_CANDIDATE_LENGTH) {
    return {
      valid: false,
      reason: `candidate too short (${trimmedCandidate.length} chars)`,
    };
  }
  if (trimmedCandidate === original.trim()) {
    return { valid: false, reason: 'candidate is identical to the original' };
  }
  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(candidate)) {
      return {
        valid: false,
        reason: `contains refusal/placeholder text (matched ${pattern})`,
      };
    }
  }

  return { valid: true };
}

/** Only 'failed' cases warrant healing — 'skipped' isn't a regression. */
export function selectFailingCases(detail: EvalRunDetail): EvalCaseResult[] {
  return detail.cases.filter((c) => c.status === 'failed');
}

/** Minimal shape of tests/eval/cases.ts's EvalCase, kept local to avoid a src/ -> tests/ import. */
export type EvalCaseSource = {
  name: string;
  prompt: string;
  expectedTool: string | null;
  expectedFactsContain?: string[];
};

export type FailingCaseContext = {
  name: string;
  prompt?: string;
  expectedTool?: string | null;
  expectedFactsContain?: string[];
  error?: string;
};

/** Joins failing eval-history cases (name/status/error) with their source definitions (prompt/expectedTool) by name. */
export function enrichFailingCases(
  failingCases: EvalCaseResult[],
  evalCases: EvalCaseSource[],
): FailingCaseContext[] {
  const byName = new Map(evalCases.map((c) => [c.name, c]));
  return failingCases.map((fc) => {
    const source = byName.get(fc.name);
    return {
      name: fc.name,
      prompt: source?.prompt,
      expectedTool: source?.expectedTool,
      expectedFactsContain: source?.expectedFactsContain,
      error: fc.error,
    };
  });
}

/**
 * Builds the healing prompt sent to Gemini: explains SYSTEM_PROMPT's
 * section structure, shows each failing case's visitor prompt / expected
 * behavior / actual failure, and asks for a complete replacement file.
 */
export function buildHealPrompt(
  promptsSource: string,
  failingCases: FailingCaseContext[],
): string {
  const failingCasesText = failingCases
    .map((c) => {
      const lines = [`- Case: "${c.name}"`];
      if (c.prompt) lines.push(`  Visitor said: "${c.prompt}"`);
      if (c.expectedTool !== undefined) {
        lines.push(
          `  Expected: ${
            c.expectedTool
              ? `call the "${c.expectedTool}" tool`
              : 'no tool call (plain conversation)'
          }`,
        );
      }
      if (c.expectedFactsContain?.length) {
        lines.push(
          `  Expected facts in the answer: ${c.expectedFactsContain.join(', ')}`,
        );
      }
      if (c.error) lines.push(`  Actual failure: ${c.error}`);
      return lines.join('\n');
    })
    .join('\n\n');

  return `You are patching a system prompt for an AI portfolio chatbot. It lives in src/lib/prompts.ts and exports a single template string, SYSTEM_PROMPT, built from an imported personalInfo object.

SYSTEM_PROMPT is organized into labeled sections:
- STYLE: tone and voice rules (third person, terse, no markdown headers/emoji).
- RULES: when the agent must call query_jared_memory and how to ground answers in the returned facts.
- SHOW, DON'T JUST TELL: when to call each UI-driving tool (focus_section, open_case_study, trigger_ui_state, set_theme, open_resume).
- KEEP DRIVING: how to close a reply with one concrete suggested next move.

An automated weekly eval suite just ran this prompt and the following case(s) failed:

${failingCasesText}

Your job: propose a revised SYSTEM_PROMPT that fixes these failures WITHOUT breaking the cases that already pass. Keep changes targeted to the section(s) that actually caused the failure(s) above — do not rewrite sections unrelated to the failures, and do not touch anything outside SYSTEM_PROMPT.

Hard requirements for your response:
- Output the COMPLETE replacement content of src/lib/prompts.ts, and nothing else — no markdown code fences, no commentary before or after.
- Preserve the exact import line: import { personalInfo } from '../data/personalInfo';
- Preserve the exact export: export const SYSTEM_PROMPT = ...
- Keep it a single template string built the same way as the original.

Current src/lib/prompts.ts:

${promptsSource}`;
}

export type ImprovementResult = {
  improved: boolean;
  beforePassRate: number;
  afterPassRate: number;
  recoveredCases: string[];
};

/**
 * Compares the triggering (failing) run against the candidate branch's
 * re-eval run. "Improved" means strictly better pass rate — an equal rate
 * (even with different cases flipping) does not clear the bar.
 */
export function evaluateImprovement(
  before: EvalRunDetail,
  after: EvalRunDetail,
): ImprovementResult {
  const beforePassRate = summarizeCases(before.cases).passRate;
  const afterPassRate = summarizeCases(after.cases).passRate;

  const beforeStatusByName = new Map(
    before.cases.map((c) => [c.name, c.status]),
  );
  const recoveredCases = after.cases
    .filter(
      (c) =>
        c.status === 'passed' && beforeStatusByName.get(c.name) !== 'passed',
    )
    .map((c) => c.name)
    .sort();

  return {
    improved: afterPassRate > beforePassRate,
    beforePassRate,
    afterPassRate,
    recoveredCases,
  };
}
