import { test, expect } from '@playwright/test';
import { evalCases } from './cases';
import {
  findToolPart,
  getRagFacts,
  hasAnyToolCall,
  parseAgentResponse,
} from './parseAgentResponse';

// Keeps sustained request rate under /api/chat's 10 req/min limiter with
// headroom. workers: 1 in playwright.eval.config.ts makes this module-level
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
  test(evalCase.name, async ({ request }) => {
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
    expect(status, sseText).toBe(200);

    const message = await parseAgentResponse(sseText);

    if (evalCase.expectedTool === null) {
      expect(hasAnyToolCall(message)).toBe(false);
    } else {
      const part = findToolPart(message, evalCase.expectedTool);
      expect(
        part,
        `expected a tool-${evalCase.expectedTool} call`,
      ).toBeTruthy();
    }

    if (evalCase.expectedFactsContain) {
      const facts = getRagFacts(message).join(' ').toLowerCase();
      for (const expectedFact of evalCase.expectedFactsContain) {
        expect(facts).toContain(expectedFact.toLowerCase());
      }
    }
  });
}
