// Output-side guardrails for /api/chat: filters leaked secrets out of the
// assistant text stream and supplies the fallback shown when Gemini blocks a reply.
import type { TextStreamPart, ToolSet } from 'ai';
import { PROMPT_CANARY } from './prompts';

export type GuardrailTripKind = 'safety' | 'output-filter';

export const GUARDRAIL_FALLBACK_TEXT =
  "That's outside what I can help with. Ask me about Jared's projects, stack, or background.";

const FALLBACK_PART_ID = 'guardrail-fallback';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LEAK_PATTERNS: readonly RegExp[] = [
  new RegExp(escapeRegExp(PROMPT_CANARY)),
  // Google API key
  /AIza[0-9A-Za-z_-]{35}/,
  // Resend API key
  /\bre_[A-Za-z0-9_]{20,}/,
  // Authorization header value
  /\bBearer\s{1,2}[A-Za-z0-9._~+/=-]{20,}/i,
  // Assigned secrets, e.g. UPSTASH_REDIS_REST_TOKEN="..."
  /(?:token|secret|api[_-]?key|password)\s{0,2}[:=]\s{0,2}["']?[A-Za-z0-9+/_-]{24,}/i,
];

// Longest shortest-possible match minus one; keeps the held-back tail short
// while guaranteeing a match split across deltas is still seen whole.
const HELD_TAIL_CHARS = 40;

function findEarliestLeak(text: string): number {
  let earliest = -1;
  for (const pattern of LEAK_PATTERNS) {
    const index = pattern.exec(text)?.index ?? -1;
    if (index !== -1 && (earliest === -1 || index < earliest)) earliest = index;
  }
  return earliest;
}

interface TextPartState {
  heldTail: string;
  tripped: boolean;
}

/**
 * Scans assistant text deltas for leaked secrets, replacing the offending text
 * with the fallback, and appends the fallback when a step ends content-filtered
 * without any text. Tool and other parts pass through untouched.
 */
export function createOutputGuard<TOOLS extends ToolSet>(
  onTrip: (kind: GuardrailTripKind) => void,
): TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>> {
  const textParts = new Map<string, TextPartState>();
  let stepEmittedText = false;

  return new TransformStream({
    transform(part, controller) {
      switch (part.type) {
        case 'start-step':
          stepEmittedText = false;
          controller.enqueue(part);
          return;

        case 'text-start':
          textParts.set(part.id, { heldTail: '', tripped: false });
          controller.enqueue(part);
          return;

        case 'text-delta': {
          const state = textParts.get(part.id);
          if (!state) {
            controller.enqueue(part);
            return;
          }
          if (state.tripped) return;

          const buffer = state.heldTail + part.text;
          const leakIndex = findEarliestLeak(buffer);

          if (leakIndex !== -1) {
            state.tripped = true;
            state.heldTail = '';
            if (leakIndex > 0) {
              controller.enqueue({
                ...part,
                text: buffer.slice(0, leakIndex),
              });
            }
            controller.enqueue({ ...part, text: GUARDRAIL_FALLBACK_TEXT });
            stepEmittedText = true;
            onTrip('output-filter');
            return;
          }

          const safeLength = Math.max(0, buffer.length - HELD_TAIL_CHARS);
          state.heldTail = buffer.slice(safeLength);
          if (safeLength > 0) {
            stepEmittedText = true;
            controller.enqueue({ ...part, text: buffer.slice(0, safeLength) });
          }
          return;
        }

        case 'text-end': {
          const state = textParts.get(part.id);
          textParts.delete(part.id);
          if (state && !state.tripped && state.heldTail) {
            stepEmittedText = true;
            controller.enqueue({
              type: 'text-delta',
              id: part.id,
              text: state.heldTail,
            });
          }
          controller.enqueue(part);
          return;
        }

        case 'finish-step':
          if (part.finishReason === 'content-filter') {
            onTrip('safety');
            if (!stepEmittedText) {
              controller.enqueue({ type: 'text-start', id: FALLBACK_PART_ID });
              controller.enqueue({
                type: 'text-delta',
                id: FALLBACK_PART_ID,
                text: GUARDRAIL_FALLBACK_TEXT,
              });
              controller.enqueue({ type: 'text-end', id: FALLBACK_PART_ID });
            }
          }
          controller.enqueue(part);
          return;

        default:
          controller.enqueue(part);
      }
    },
  });
}
