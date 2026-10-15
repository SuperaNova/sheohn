import { test, expect } from '@playwright/test';
import {
  InfraError,
  describeResponse,
  isInfraStatus,
} from '../../src/lib/eval-infra';
import { evalCases } from './cases';
import {
  findToolPart,
  getAssistantText,
  getRagFacts,
  hasAnyToolCall,
  parseAgentResponse,
} from './parseAgentResponse';

// Keeps sustained request rate under /api/chat's 10 req/min limiter with
// headroom. workers: 1 in tests/eval/playwright.config.ts makes this module-level
// counter meaningful — cases run one at a time in a single worker process.
const THROTTLE_MS = 6500;
let isFirstCase = true;

test.beforeEach(async () => {
  if (isFirstCase) {
    isFirstCase = false;
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS));
});

for (const evalCase of evalCases) {
  const tag = evalCase.category === 'adversarial' ? '@adversarial' : undefined;
  test(evalCase.name, { tag }, async ({ request }) => {
    const response = await request.post('/api/chat', {
      data: {
        messages: [
          {
            id: 'eval-case',
            role: 'user',
            parts: [{ type: 'text', text: evalCase.prompt }],
          },
        ],
      },
    });

    const status = response.status();
    const sseText = await response.text();
    if (isInfraStatus(status)) {
      throw new InfraError(describeResponse(status, sseText));
    }
    expect(status, sseText).toBe(200);

    const message = await parseAgentResponse(sseText, status);

    if (evalCase.expectedTool === null) {
      expect(hasAnyToolCall(message)).toBe(false);
    } else if (evalCase.expectedTool !== undefined) {
      const part = findToolPart(message, evalCase.expectedTool);
      expect(
        part,
        `expected a tool-${evalCase.expectedTool} call`,
      ).toBeTruthy();
    }

    for (const forbiddenTool of evalCase.forbiddenTools ?? []) {
      expect(
        findToolPart(message, forbiddenTool),
        `forbidden tool-${forbiddenTool} was called`,
      ).toBeUndefined();
    }

    if (evalCase.responseMustNotContain) {
      const text = getAssistantText(message).toLowerCase();
      for (const forbiddenText of evalCase.responseMustNotContain) {
        expect(
          text.includes(forbiddenText.toLowerCase()),
          `response text leaked "${forbiddenText}": ${text}`,
        ).toBe(false);
      }
    }

    if (evalCase.expectedFactsContain) {
      const facts = getRagFacts(message).join(' ').toLowerCase();
      for (const expectedFact of evalCase.expectedFactsContain) {
        expect(facts).toContain(expectedFact.toLowerCase());
      }
    }
  });
}
