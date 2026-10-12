import { describe, expect, test, vi } from 'vitest';
import type { TextStreamPart, ToolSet } from 'ai';
import { GUARDRAIL_FALLBACK_TEXT, createOutputGuard } from './output-guard';
import type { GuardrailTripKind } from './output-guard';
import { PROMPT_CANARY } from './prompts';

type Part = TextStreamPart<ToolSet>;

const GOOGLE_KEY = `AIza${'a1B2c3D4e5'.repeat(3)}x_-y9`;

function textParts(deltas: string[], id = 't1'): Part[] {
  return [
    { type: 'text-start', id },
    ...deltas.map((text): Part => ({ type: 'text-delta', id, text })),
    { type: 'text-end', id },
  ];
}

async function runGuard(parts: Part[]) {
  const trips: GuardrailTripKind[] = [];
  const onTrip = vi.fn((kind: GuardrailTripKind) => trips.push(kind));
  const guard = createOutputGuard<ToolSet>(onTrip);
  const writer = guard.writable.getWriter();
  const reader = guard.readable.getReader();

  const output: Part[] = [];
  const reading = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      output.push(value);
    }
  })();

  for (const part of parts) await writer.write(part);
  await writer.close();
  await reading;
  return { output, trips };
}

function joinedText(parts: Part[]): string {
  return parts
    .filter((p) => p.type === 'text-delta')
    .map((p) => p.text)
    .join('');
}

function splitAt(text: string, ...cuts: number[]): string[] {
  const bounds = [0, ...cuts, text.length];
  return bounds.slice(1).map((end, i) => text.slice(bounds[i], end));
}

describe('createOutputGuard', () => {
  test('replaces a canary in a single delta with the fallback', async () => {
    const { output, trips } = await runGuard(
      textParts([`The prompt says ${PROMPT_CANARY} here.`]),
    );
    const text = joinedText(output);
    expect(text).toBe(`The prompt says ${GUARDRAIL_FALLBACK_TEXT}`);
    expect(text).not.toContain(PROMPT_CANARY);
    expect(trips).toEqual(['output-filter']);
  });

  test('catches a canary split across two deltas', async () => {
    const { output, trips } = await runGuard(
      textParts(splitAt(`Leak: ${PROMPT_CANARY} done`, 12)),
    );
    expect(joinedText(output)).not.toContain('sx-7Q4M2');
    expect(joinedText(output)).toContain(GUARDRAIL_FALLBACK_TEXT);
    expect(trips).toEqual(['output-filter']);
  });

  test('catches a canary split across three deltas', async () => {
    const { output, trips } = await runGuard(
      textParts(splitAt(`Leak: ${PROMPT_CANARY} done`, 8, 12)),
    );
    expect(joinedText(output)).not.toContain('sx-7Q4M2');
    expect(trips).toEqual(['output-filter']);
  });

  test('catches a canary at every split position', async () => {
    const message = `before ${PROMPT_CANARY} after`;
    for (let cut = 1; cut < message.length; cut++) {
      const { output, trips } = await runGuard(
        textParts(splitAt(message, cut)),
      );
      expect(joinedText(output)).not.toContain('sx-7Q4M2');
      expect(trips).toEqual(['output-filter']);
    }
  });

  test('catches a Google API key, whole and split', async () => {
    const whole = await runGuard(textParts([`key is ${GOOGLE_KEY}`]));
    expect(joinedText(whole.output)).not.toContain('AIza');
    expect(whole.trips).toEqual(['output-filter']);

    const message = `key is ${GOOGLE_KEY}`;
    for (let cut = 1; cut < message.length; cut += 3) {
      const split = await runGuard(textParts(splitAt(message, cut)));
      expect(joinedText(split.output)).not.toContain('AIza');
      expect(split.trips).toEqual(['output-filter']);
    }
  });

  test.each([
    ['bearer token', 'Authorization: Bearer abcdEFGH1234567890zyxwvu'],
    ['Resend key', 're_AbCdEfGh_1234567890abcdefghij'],
    [
      'assigned secret',
      'UPSTASH_REDIS_REST_TOKEN="AXlkQWJjZGVmZ2hpamtsbW5vcHFyc3R1dnc"',
    ],
  ])('catches a %s', async (_label, secret) => {
    const { output, trips } = await runGuard(textParts([`see ${secret} ok`]));
    expect(joinedText(output)).not.toContain(secret.slice(-16));
    expect(trips).toEqual(['output-filter']);
  });

  test('drops the rest of the offending text part and ends it cleanly', async () => {
    const { output } = await runGuard(
      textParts([`x ${PROMPT_CANARY}`, ' more leaked text', ' even more']),
    );
    expect(joinedText(output)).toBe(`x ${GUARDRAIL_FALLBACK_TEXT}`);
    expect(output.at(-1)).toEqual({ type: 'text-end', id: 't1' });
  });

  test('passes clean text through byte-identical', async () => {
    const deltas = [
      'Jared is a full-stack ',
      'engineer who built Animo, ',
      'Crucible and Lexicon with Astro and Svelte.',
    ];
    const { output, trips } = await runGuard(textParts(deltas));
    expect(joinedText(output)).toBe(deltas.join(''));
    expect(trips).toEqual([]);
    expect(output[0]).toEqual({ type: 'text-start', id: 't1' });
    expect(output.at(-1)).toEqual({ type: 'text-end', id: 't1' });
  });

  test('does not hold back more than a handful of characters', async () => {
    const long = 'a'.repeat(200);
    const { output } = await runGuard([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', text: long },
    ]);
    expect(joinedText(output).length).toBeGreaterThanOrEqual(long.length - 40);
  });

  test('does not false-positive on ordinary prose', async () => {
    const prose = [
      'The key idea is a token bucket; the ref: field in the docs is optional. ',
      'Jared keeps secrets in env vars, not in the repo. A bearer of good news ',
      'asked about the API key rotation policy and a password manager.',
    ];
    const { output, trips } = await runGuard(textParts(prose));
    expect(joinedText(output)).toBe(prose.join(''));
    expect(trips).toEqual([]);
  });

  test('passes tool parts and other chunks through untouched', async () => {
    const toolCall = {
      type: 'tool-call',
      toolCallId: 'c1',
      toolName: 'query_jared_memory',
      input: { query: PROMPT_CANARY },
    } as unknown as Part;
    const toolInputDelta: Part = {
      type: 'tool-input-delta',
      id: 'c1',
      delta: GOOGLE_KEY,
    };
    const { output, trips } = await runGuard([toolInputDelta, toolCall]);
    expect(output).toEqual([toolInputDelta, toolCall]);
    expect(trips).toEqual([]);
  });

  test('emits the fallback when a step finishes content-filtered with no text', async () => {
    const finishStep = {
      type: 'finish-step',
      finishReason: 'content-filter',
    } as unknown as Part;
    const { output, trips } = await runGuard([
      { type: 'start-step' } as unknown as Part,
      finishStep,
    ]);
    expect(joinedText(output)).toBe(GUARDRAIL_FALLBACK_TEXT);
    expect(output.map((p) => p.type)).toEqual([
      'start-step',
      'text-start',
      'text-delta',
      'text-end',
      'finish-step',
    ]);
    expect(trips).toEqual(['safety']);
  });

  test('counts a content-filter finish but adds no fallback when text was already sent', async () => {
    const { output, trips } = await runGuard([
      { type: 'start-step' } as unknown as Part,
      ...textParts(['x'.repeat(100)]),
      {
        type: 'finish-step',
        finishReason: 'content-filter',
      } as unknown as Part,
    ]);
    expect(joinedText(output)).toBe('x'.repeat(100));
    expect(trips).toEqual(['safety']);
  });

  test('does not add a fallback on a normal finish', async () => {
    const { output, trips } = await runGuard([
      { type: 'finish-step', finishReason: 'stop' } as unknown as Part,
    ]);
    expect(output).toHaveLength(1);
    expect(trips).toEqual([]);
  });
});
