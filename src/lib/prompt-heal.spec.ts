import { describe, expect, test } from 'vitest';
import {
  buildHealPrompt,
  enrichFailingCases,
  evaluateImprovement,
  selectFailingCases,
  stripCodeFence,
  validateCandidate,
  type EvalCaseSource,
} from './prompt-heal';
import type { EvalRunDetail } from './eval-history';

const ORIGINAL = `import { personalInfo } from '../data/personalInfo';

export const SYSTEM_PROMPT = \`You are the digital agent FOR ${'${personalInfo.name}'}, a ${'${personalInfo.title}'}. You are NOT Jared — you are his portfolio's resident terminal agent talking ABOUT him to visitors.

STYLE
- Terse, technical, slightly edgy — match the terminal aesthetic of the portfolio.
- ALWAYS speak in third person: "Jared is...", "He built...". Never "I" or "my".

RULES
- For ANY question about Jared's background, you MUST call query_jared_memory FIRST and ground your answer in the returned facts.
- Do not guess or extrapolate beyond what was retrieved.

KEEP DRIVING: End most replies by proposing a concrete next move.
\`;`;

function validCandidate(extra = ''): string {
  return `import { personalInfo } from '../data/personalInfo';

export const SYSTEM_PROMPT = \`You are the digital agent FOR ${'${personalInfo.name}'}, a ${'${personalInfo.title}'}. You are NOT Jared — you are his portfolio's resident terminal agent talking ABOUT him to visitors.

STYLE
- Terse, technical, but slightly friendlier now — match the terminal aesthetic of the portfolio.${extra}
- ALWAYS speak in third person: "Jared is...", "He built...". Never "I" or "my".

RULES
- For ANY question about Jared's background, you MUST call query_jared_memory FIRST for any background question and ground your answer in the returned facts.
- Do not guess or extrapolate beyond what was retrieved.

KEEP DRIVING: End most replies by proposing a concrete next move.
\`;`;
}

describe('stripCodeFence', () => {
  test('strips a ```typescript fenced block', () => {
    const raw = '```typescript\nconst a = 1;\n```';
    expect(stripCodeFence(raw)).toBe('const a = 1;');
  });

  test('strips a plain ``` fenced block with no language tag', () => {
    const raw = '```\nconst a = 1;\n```';
    expect(stripCodeFence(raw)).toBe('const a = 1;');
  });

  test('returns trimmed content unchanged when there is no fence', () => {
    const raw = '  const a = 1;  \n';
    expect(stripCodeFence(raw)).toBe('const a = 1;');
  });
});

describe('validateCandidate', () => {
  test('accepts a well-formed, meaningfully different candidate', () => {
    const result = validateCandidate(validCandidate(), ORIGINAL);
    expect(result.valid).toBe(true);
  });

  test('rejects a candidate missing export const SYSTEM_PROMPT', () => {
    const fixture = `import { personalInfo } from '../data/personalInfo';\nexport const NOT_THE_RIGHT_NAME = 'oops';`;
    const result = validateCandidate(fixture, ORIGINAL);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/SYSTEM_PROMPT/);
  });

  test('rejects a candidate missing the personalInfo import', () => {
    const fixture = `export const SYSTEM_PROMPT = 'x'.repeat(500);`;
    const result = validateCandidate(fixture, ORIGINAL);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/import/);
  });

  test('rejects a candidate that is too short', () => {
    const fixture = `import { personalInfo } from '../data/personalInfo';\nexport const SYSTEM_PROMPT = 'short';`;
    const result = validateCandidate(fixture, ORIGINAL);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/too short/);
  });

  test('rejects a candidate identical to the original', () => {
    const result = validateCandidate(ORIGINAL, ORIGINAL);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/identical/);
  });

  test('rejects a candidate containing refusal text', () => {
    const fixture = validCandidate(
      "\n\nI cannot help with modifying this file further, here's the rest padded out to be long enough to pass the length check on its own.",
    );
    const result = validateCandidate(fixture, ORIGINAL);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/refusal/);
  });
});

describe('selectFailingCases', () => {
  test('keeps only failed cases, ignoring passed and skipped', () => {
    const detail: EvalRunDetail = {
      date: '2026-07-13',
      commitSha: 'abc123',
      cases: [
        { name: 'a', status: 'passed', durationMs: 10 },
        { name: 'b', status: 'failed', durationMs: 20, error: 'boom' },
        { name: 'c', status: 'skipped', durationMs: 0 },
      ],
    };
    expect(selectFailingCases(detail).map((c) => c.name)).toEqual(['b']);
  });
});

describe('enrichFailingCases', () => {
  const evalCases: EvalCaseSource[] = [
    {
      name: 'query_jared_memory — background question',
      prompt: "What is Jared's background?",
      expectedTool: 'query_jared_memory',
      expectedFactsContain: ['CIT-U'],
    },
  ];

  test('joins a failing case with its source prompt/expectedTool by name', () => {
    const failing = [
      {
        name: 'query_jared_memory — background question',
        status: 'failed' as const,
        durationMs: 5,
        error: 'tool not called',
      },
    ];
    const [enriched] = enrichFailingCases(failing, evalCases);
    expect(enriched).toMatchObject({
      name: 'query_jared_memory — background question',
      prompt: "What is Jared's background?",
      expectedTool: 'query_jared_memory',
      expectedFactsContain: ['CIT-U'],
      error: 'tool not called',
    });
  });

  test('tolerates a failing case with no matching source definition', () => {
    const failing = [
      { name: 'unknown case', status: 'failed' as const, durationMs: 5 },
    ];
    const [enriched] = enrichFailingCases(failing, evalCases);
    expect(enriched).toMatchObject({ name: 'unknown case' });
    expect(enriched!.prompt).toBeUndefined();
  });
});

describe('buildHealPrompt', () => {
  test('includes the section explainer, failing case details, and the current source', () => {
    const prompt = buildHealPrompt(ORIGINAL, [
      {
        name: 'set_theme — dark mode',
        prompt: 'Switch to dark mode.',
        expectedTool: 'set_theme',
        error: 'no tool call',
      },
    ]);

    expect(prompt).toContain('SYSTEM_PROMPT');
    expect(prompt).toContain('STYLE');
    expect(prompt).toContain('KEEP DRIVING');
    expect(prompt).toContain('set_theme — dark mode');
    expect(prompt).toContain('Switch to dark mode.');
    expect(prompt).toContain('call the "set_theme" tool');
    expect(prompt).toContain('no tool call');
    expect(prompt).toContain(ORIGINAL);
    expect(prompt).not.toContain('```');
  });

  test('describes a null expectedTool as plain conversation', () => {
    const prompt = buildHealPrompt(ORIGINAL, [
      {
        name: 'off-topic decline',
        prompt: 'Tell me a joke.',
        expectedTool: null,
      },
    ]);
    expect(prompt).toContain('no tool call (plain conversation)');
  });
});

describe('evaluateImprovement', () => {
  const before: EvalRunDetail = {
    date: '2026-07-13',
    commitSha: 'before-sha',
    cases: [
      { name: 'a', status: 'passed', durationMs: 10 },
      { name: 'b', status: 'failed', durationMs: 20 },
      { name: 'c', status: 'failed', durationMs: 20 },
    ],
  };

  test('reports improved: true and lists recovered cases when pass rate rises', () => {
    const after: EvalRunDetail = {
      date: 'candidate',
      commitSha: 'after-sha',
      cases: [
        { name: 'a', status: 'passed', durationMs: 10 },
        { name: 'b', status: 'passed', durationMs: 15 },
        { name: 'c', status: 'failed', durationMs: 20 },
      ],
    };
    const result = evaluateImprovement(before, after);
    expect(result.improved).toBe(true);
    expect(result.beforePassRate).toBeCloseTo(33.3, 1);
    expect(result.afterPassRate).toBeCloseTo(66.7, 1);
    expect(result.recoveredCases).toEqual(['b']);
  });

  test('reports improved: false when the pass rate does not strictly increase', () => {
    const after: EvalRunDetail = {
      date: 'candidate',
      commitSha: 'after-sha',
      cases: [
        { name: 'a', status: 'passed', durationMs: 10 },
        { name: 'b', status: 'failed', durationMs: 20 },
        { name: 'c', status: 'failed', durationMs: 20 },
      ],
    };
    const result = evaluateImprovement(before, after);
    expect(result.improved).toBe(false);
    expect(result.recoveredCases).toEqual([]);
  });

  test('reports improved: false when the pass rate ties even if different cases flip', () => {
    const after: EvalRunDetail = {
      date: 'candidate',
      commitSha: 'after-sha',
      cases: [
        { name: 'a', status: 'failed', durationMs: 10 },
        { name: 'b', status: 'passed', durationMs: 15 },
        { name: 'c', status: 'failed', durationMs: 20 },
      ],
    };
    const result = evaluateImprovement(before, after);
    expect(result.improved).toBe(false);
  });
});
