# Agent Eval Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manual-run Playwright eval suite that exercises the live `/api/chat` CommandDeck agent against ~10 golden prompts, asserting on tool selection and (for a subset) RAG fact accuracy.

**Architecture:** A dedicated Playwright config (`playwright.eval.config.ts`, port 4398, `workers: 1`, `retries: 1`) boots the same build+preview server pattern as the e2e suite, but points at `tests/eval/` instead of `tests/e2e/`. `tests/eval/agent.eval.ts` iterates a data-only fixture list (`tests/eval/cases.ts`), POSTs each prompt to `/api/chat` via Playwright's buffering `request` fixture, and hands the raw SSE text to `tests/eval/parseAgentResponse.ts` — which wraps the AI SDK's `parseJsonEventStream` + `readUIMessageStream` to reassemble a `UIMessage`, then exposes tiny grading helpers (`findToolPart`, `hasAnyToolCall`, `getRagFacts`) built on `ai`'s `isToolUIPart`/`getToolName`. A self-throttle between cases keeps the suite under `/api/chat`'s existing 10 req/min rate limiter.

**Tech Stack:** Playwright (`@playwright/test` ^1.60.0, already a devDependency), Vercel AI SDK (`ai` ^6.0.149 / resolved 6.0.191, already a dependency) — no new dependencies required.

## Global Constraints

- Rate limiter on `/api/chat` (`src/lib/ratelimit.ts` via `src/pages/api/chat.ts:46,139-142`): sliding window, 10 requests/min, keyed by Astro `clientAddress`. The eval suite must never trip it.
- Self-throttle: ~6.5s between cases (spec: "makes each additional case cost ~6.5s of wall time").
- `retries: 1` in the eval Playwright config — one retry per failing case, no more.
- `workers: 1` — cases must run sequentially (required for the throttle to be meaningful).
- Dedicated port **4398** for the eval webServer (distinct from e2e's 4399).
- Never wire `eval:agent` into `preflight` or any CI workflow — manual-only, per spec ("makes real Gemini + Upstash calls and costs money/tokens per run").
- No changes to `src/pages/api/chat.ts` or `src/lib/ratelimit.ts` — the throttle lives entirely in the eval suite (spec: "no new bypass surface in production code").
- No meta-tests for the harness itself (spec, "Testing the harness itself"): correctness is verified by actually running `npm run eval:agent` against the live (working) agent once wiring is complete — not by unit-testing the harness's own parsing/grading code. Each task below uses `npx playwright test --config=playwright.eval.config.ts --list` (enumerates tests, no server boot, no network calls, free) as its cheap intermediate check; only the final task runs the real suite.
- POST body to `/api/chat` must match `ChatBodySchema` (`src/pages/api/chat.ts:55-66`): `{ messages: [{ id?, role: 'user'|'assistant', parts?: [{type, text?}] }] }`, content-type `application/json` (enforced at `chat.ts:130-134`).
- Response parts from the live agent are typed `` `tool-${toolName}` `` (e.g. `tool-open_case_study`, `tool-query_jared_memory`) per AI SDK v6's `ToolUIPart` — not a literal `'tool-call'` type. Grading must check for this typed-part shape.

---

## File Structure

- Create `playwright.eval.config.ts` (repo root) — dedicated config, port 4398, `testDir: './tests/eval'`.
- Create `tests/eval/cases.ts` — `EvalCase` type + `evalCases` array. Data only, no logic.
- Create `tests/eval/parseAgentResponse.ts` — SSE-text → `UIMessage` parsing (`parseAgentResponse`) plus grading helpers (`findToolPart`, `hasAnyToolCall`, `getRagFacts`) that consume the parsed message.
- Create `tests/eval/agent.eval.ts` — one `test()` per case from `cases.ts`, self-throttled via `test.beforeEach`, asserts via the helpers from `parseAgentResponse.ts`.
- Modify `package.json` — add `"eval:agent": "playwright test --config=playwright.eval.config.ts"` to `scripts`.

---

## Task 1: Dedicated Playwright eval config

**Files:**
- Create: `playwright.eval.config.ts`

**Interfaces:**
- Produces: a Playwright config whose `testDir` is `./tests/eval`, `baseURL` is `http://localhost:4398`, `workers: 1`, `retries: 1`, `reporter: 'list'`. Later tasks' test files rely on this config being invoked via `--config=playwright.eval.config.ts` (never picked up by the default `playwright test` / `test:e2e` run, since that uses `playwright.config.ts` with `testDir: './tests/e2e'`).

- [ ] **Step 1: Create `playwright.eval.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

// Dedicated eval port, distinct from the e2e suite's 4399 — lets both
// suites boot their own preview server without colliding if run back to
// back. workers: 1 is required so the self-throttle in agent.eval.ts
// (which relies on tests running sequentially) actually paces requests.
const PORT = 4398;
const HOST = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/eval',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: HOST,
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --host`,
    url: HOST,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors referencing `playwright.eval.config.ts`. (Not using `playwright test --list` here — with no test files under `tests/eval` yet, Playwright's CLI exits non-zero with "no tests found" rather than confirming the config is valid; that check happens in Task 4 Step 3 once `agent.eval.ts` exists.)

- [ ] **Step 3: Commit**

```bash
git add playwright.eval.config.ts
git commit -m "feat: add dedicated playwright config for agent eval suite"
```

---

## Task 2: Golden case fixtures

**Files:**
- Create: `tests/eval/cases.ts`

**Interfaces:**
- Produces: `EvalCase` type and `evalCases: EvalCase[]` array, imported by Task 4's `agent.eval.ts` as `import { evalCases, type EvalCase } from './cases';`.

**Context:** Prompts are grounded in the real system prompt (`src/lib/prompts.ts`) and real content so the live agent has a fair shot at calling the right tool:
- `focus_section` sections: `hero | about | stack | projects | contact` (`src/pages/api/chat.ts:233-246`).
- `set_theme` modes: `light | dark` (`chat.ts:247-258`).
- Real project slug for `open_case_study`: `crucible` (`src/content/projects/crucible.mdx`, title "Crucible — Autonomous Sprite Synthesis Pipeline").
- RAG-grounding facts pulled from `src/data/personalInfo.ts`: education is `"Bachelor of Science in Computer Science @ CIT-U"` (contains "Computer Science" and "CIT-U"); bio is `"President of GDG on Campus CIT-U..."` (contains "GDG" and "President"). These strings are the most authoritative source of what should be embedded in the Upstash Vector index, but the index itself isn't inspectable from this repo — Task 4's final live run is what actually confirms these substrings show up in retrieved facts. If a fact substring doesn't match on the first live run, narrow it to a shorter, more certain fragment (e.g. just `"CIT-U"`) rather than deleting the case.

- [ ] **Step 1: Create `tests/eval/cases.ts`**

```ts
export type EvalCase = {
  name: string;
  prompt: string;
  expectedTool: string | null; // null = expect no tool call at all
  expectedFactsContain?: string[]; // only checked for query_jared_memory cases
};

export const evalCases: EvalCase[] = [
  {
    name: 'open_case_study — named project',
    prompt: 'Open the Crucible case study.',
    expectedTool: 'open_case_study',
  },
  {
    name: 'open_resume — resume request',
    prompt: 'Can I see his resume?',
    expectedTool: 'open_resume',
  },
  {
    name: 'focus_section — tech stack overview',
    prompt: "What's his tech stack?",
    expectedTool: 'focus_section',
  },
  {
    name: 'set_theme — dark mode',
    prompt: 'Switch to dark mode.',
    expectedTool: 'set_theme',
  },
  {
    name: 'trigger_ui_state — tech highlight',
    prompt: 'Show me his AI work.',
    expectedTool: 'trigger_ui_state',
  },
  {
    name: 'query_jared_memory — background question',
    prompt: "What is Jared's educational background?",
    expectedTool: 'query_jared_memory',
  },
  {
    name: 'plain conversation — off-topic decline',
    prompt: 'Tell me a joke about a random celebrity.',
    expectedTool: null,
  },
  {
    name: 'plain conversation — trivial math',
    prompt: 'What is 12 times 12?',
    expectedTool: null,
  },
  {
    name: 'query_jared_memory — education facts',
    prompt: 'Where does Jared go to school and what is he studying?',
    expectedTool: 'query_jared_memory',
    expectedFactsContain: ['CIT-U', 'Computer Science'],
  },
  {
    name: 'query_jared_memory — leadership facts',
    prompt: 'What leadership roles does Jared hold?',
    expectedTool: 'query_jared_memory',
    expectedFactsContain: ['GDG', 'President'],
  },
];
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors referencing `tests/eval/cases.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/eval/cases.ts
git commit -m "feat: add golden case fixtures for agent eval suite"
```

---

## Task 3: SSE-to-UIMessage parsing and grading helpers

**Files:**
- Create: `tests/eval/parseAgentResponse.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (standalone AI SDK wrapper).
- Produces, for Task 4:
  - `parseAgentResponse(sseText: string): Promise<UIMessage>`
  - `findToolPart(message: UIMessage, toolName: string): ReturnType<typeof isToolUIPart> extends true ? unknown : unknown` — practically: returns the matching part object or `undefined`.
  - `hasAnyToolCall(message: UIMessage): boolean`
  - `getRagFacts(message: UIMessage): string[]`

**Context:** Playwright's `request` fixture (`APIResponse`) buffers the full response body rather than exposing a streaming `ReadableStream` the way `fetch`'s `Response.body` does, so `parseAgentResponse` takes the already-awaited SSE text (a `string`) and wraps it as a single-chunk `ReadableStream<Uint8Array>` before feeding the AI SDK's own SSE parsing pipeline. This mirrors what `DefaultChatTransport` does internally (`node_modules/ai/src/ui/default-chat-transport.ts`): `parseJsonEventStream({ stream, schema: uiMessageChunkSchema })` piped through a transform that unwraps `ParseResult` (`{success: true, value} | {success: false, error}`, confirmed at `node_modules/@ai-sdk/provider-utils/dist/index.d.ts:325-333`) into a `UIMessageChunk` stream, which `readUIMessageStream` then reduces into a `UIMessage`. `query_jared_memory`'s tool `execute` returns a bare `string[]` of facts directly (`src/pages/api/chat.ts:273-316`), so `getRagFacts` reads `part.output` with no further unwrapping.

- [ ] **Step 1: Create `tests/eval/parseAgentResponse.ts`**

```ts
import {
  getToolName,
  isToolUIPart,
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';

/**
 * Playwright's `request` fixture buffers the full response body as text
 * rather than exposing a streaming body, so this wraps that text back into
 * a single-chunk ReadableStream to feed the AI SDK's own SSE parsing —
 * the same pipeline DefaultChatTransport uses for real streaming responses.
 */
export async function parseAgentResponse(sseText: string): Promise<UIMessage> {
  const bytes = new TextEncoder().encode(sseText);
  const rawStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  const chunkStream: ReadableStream<UIMessageChunk> = parseJsonEventStream({
    stream: rawStream,
    schema: uiMessageChunkSchema,
  }).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        if (!chunk.success) {
          throw chunk.error;
        }
        controller.enqueue(chunk.value);
      },
    }),
  );

  let finalMessage: UIMessage | undefined;
  for await (const message of readUIMessageStream({ stream: chunkStream })) {
    finalMessage = message;
  }

  if (!finalMessage) {
    throw new Error(
      'parseAgentResponse: no UIMessage chunks were parsed from the SSE response',
    );
  }

  return finalMessage;
}

export function findToolPart(message: UIMessage, toolName: string) {
  return message.parts.find(
    (part) => isToolUIPart(part) && getToolName(part) === toolName,
  );
}

export function hasAnyToolCall(message: UIMessage): boolean {
  return message.parts.some((part) => isToolUIPart(part));
}

export function getRagFacts(message: UIMessage): string[] {
  const part = findToolPart(message, 'query_jared_memory');
  if (!part || !('output' in part)) {
    return [];
  }
  const output = (part as { output?: unknown }).output;
  return Array.isArray(output) ? output.map(String) : [];
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors referencing `tests/eval/parseAgentResponse.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/eval/parseAgentResponse.ts
git commit -m "feat: add SSE-to-UIMessage parsing and grading helpers for agent eval suite"
```

---

## Task 4: Eval test file, package.json wiring, and live verification run

**Files:**
- Create: `tests/eval/agent.eval.ts`
- Modify: `package.json` (add `eval:agent` script)

**Interfaces:**
- Consumes: `evalCases`/`EvalCase` from `tests/eval/cases.ts` (Task 2); `parseAgentResponse`, `findToolPart`, `hasAnyToolCall`, `getRagFacts` from `tests/eval/parseAgentResponse.ts` (Task 3); `test`/`expect` from `@playwright/test`, run via `playwright.eval.config.ts` (Task 1).
- Produces: `npm run eval:agent` — the fully wired command described in the spec.

- [ ] **Step 1: Create `tests/eval/agent.eval.ts`**

```ts
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
      expect(part, `expected a tool-${evalCase.expectedTool} call`).toBeTruthy();
    }

    if (evalCase.expectedFactsContain) {
      const facts = getRagFacts(message).join(' ').toLowerCase();
      for (const expectedFact of evalCase.expectedFactsContain) {
        expect(facts).toContain(expectedFact.toLowerCase());
      }
    }
  });
}
```

- [ ] **Step 2: Add the `eval:agent` script to `package.json`**

In the `"scripts"` block, add (near the other `test:*` entries — no `eval:*` entries exist yet, this is the first):

```json
"eval:agent": "playwright test --config=playwright.eval.config.ts"
```

- [ ] **Step 3: Cheap sanity check — confirm all 10 cases are discovered (no server boot, no network calls)**

Run: `npx playwright test --config=playwright.eval.config.ts --list`
Expected: lists all 10 test names from `tests/eval/cases.ts` (e.g. `agent.eval.ts:NN:N › open_case_study — named project`, one per case), `10 tests in 1 file`.

- [ ] **Step 4: Confirm required env vars are present**

Run: `grep -c "GOOGLE_GENERATIVE_AI_API_KEY\|UPSTASH_VECTOR_REST_URL\|UPSTASH_VECTOR_REST_TOKEN\|UPSTASH_REDIS_REST_URL\|UPSTASH_REDIS_REST_TOKEN" .env`
Expected: `5` (all five vars present in `.env` — required for `npm run preview`'s `/api/chat` to actually work; a missing var surfaces as every case failing per the spec's Error Handling section, so confirming this first avoids wasting a full throttled run on infra rather than agent behavior).

- [ ] **Step 5: Full live run — this is the harness's real verification, per spec ("Testing the harness itself")**

Run: `npm run eval:agent`
Expected: `10 passed` (or 10 passed after Playwright's built-in single retry on any case). This is a real Gemini + Upstash run — takes roughly a minute (`~10 cases × 6.5s` throttle plus model latency plus any retries). If a case fails after retry, inspect whether it's a genuine tool-selection/RAG regression (fix the case's prompt or expected value, don't loosen assertions to force a pass) versus an infra issue (env vars, rate limiting from another process hitting the same preview server).

- [ ] **Step 6: Commit**

```bash
git add tests/eval/agent.eval.ts package.json
git commit -m "feat: wire up agent eval suite (npm run eval:agent)"
```

---

## Self-Review Notes

- **Spec coverage:** Architecture (Task 1 config + file layout across Tasks 1-4), golden case format and seed set (Task 2), grading — primary tool selection and secondary RAG accuracy (Task 3 helpers, applied in Task 4), retry/rate-limiting (`retries: 1` in Task 1, self-throttle in Task 4), reporting (`reporter: 'list'` in Task 1), wiring (`eval:agent` script in Task 4), error handling (relies on Playwright's own `webServer` timeout and `retries` — no custom code, consistent with spec), testing the harness itself (no meta-tests; Task 4 Step 5 is the live-run verification the spec calls for).
- **Corrected from the spec's loose wording:** the spec refers to "tool-call parts" and "tool-result facts" generically; this plan grades against AI SDK v6's actual `` `tool-${toolName}` ``-typed `ToolUIPart` shape (via `isToolUIPart`/`getToolName`) and reads `part.output` directly for `query_jared_memory`'s bare `string[]` return value, both confirmed against the installed `ai@6.0.191` type declarations and `src/pages/api/chat.ts`.
- **Type consistency:** `EvalCase` (Task 2) fields (`name`, `prompt`, `expectedTool`, `expectedFactsContain`) are used identically in Task 4's loop. `parseAgentResponse`/`findToolPart`/`hasAnyToolCall`/`getRagFacts` (Task 3) signatures match their call sites in Task 4 exactly.
