# Agent Eval Harness — Design

## Problem

`src/pages/api/chat.ts` drives the CommandDeck agent: a system prompt plus 6
tools (`open_case_study`, `open_resume`, `focus_section`, `set_theme`,
`trigger_ui_state`, `query_jared_memory`). Nothing currently catches
regressions when the prompt, tool descriptions, or RAG data change — e.g. the
model starts calling the wrong tool for a known phrasing, or
`query_jared_memory` stops surfacing an expected fact. This spec covers a
manual-run eval harness that exercises the live agent against a small set of
golden prompts and checks tool selection (primary) and RAG fact accuracy
(secondary).

Out of scope: CI integration, LLM-as-judge grading of free-text answers,
multi-turn conversation cases. All YAGNI for v1 — add later if the
single-turn/deterministic-grading harness proves insufficient.

## Goals

- Catch tool-selection regressions: given a known prompt, did the expected
  tool (or no tool) fire?
- Catch obvious RAG drift: for a subset of `query_jared_memory` cases, did the
  retrieved facts contain the expected substrings?
- Run on demand (`npm run eval:agent`), never in CI or `preflight` — this
  makes real Gemini + Upstash calls and costs money/tokens per run.
- Tolerate one-off model non-determinism without hiding real regressions
  (retry once before failing a case).
- Never trip `/api/chat`'s existing 10 req/min rate limiter during a run.

## Architecture

New files, all isolated from the existing `tests/e2e` Playwright suite:

- `playwright.eval.config.ts` — dedicated Playwright config, port `4398`
  (distinct from the e2e suite's `4399`). Reuses the same `webServer` boot
  pattern as `playwright.config.ts:34-39` (`npm run build && npm run preview`,
  `reuseExistingServer: !process.env.CI`). `retries: 1` so each case gets up
  to 2 attempts total. `workers: 1` — cases must run sequentially to respect
  the self-throttle (see Rate Limiting below). Reporter: `list`.
- `tests/eval/agent.eval.ts` — the Playwright test file. One `test()` per
  golden case, using the `request` API-testing fixture (no browser). Only
  ever run via `playwright.eval.config.ts`'s `testDir`, so it's never picked
  up by `test:e2e`.
- `tests/eval/cases.ts` — golden case fixtures (data only, no logic).
- `tests/eval/parseAgentResponse.ts` — helper that wraps `ai`'s
  `readUIMessageStream` to turn the raw SSE `Response` body from `/api/chat`
  into a structured `UIMessage`, so cases assert against parsed `tool-call`
  parts instead of raw SSE bytes.

### Why Playwright instead of a standalone script

Considered a hand-written Node script (`scripts/eval-agent.mjs`) with its own
server boot/teardown and retry logic. Rejected in favor of reusing
Playwright, which this repo already depends on and which already solves
server lifecycle management (boot, health-check wait, teardown) for
`tests/e2e`. The eval suite borrows that solved problem instead of
re-solving it, and gets `retries` and reporting for free.

## Golden case format

```ts
// tests/eval/cases.ts
type EvalCase = {
  name: string;
  prompt: string;
  expectedTool: string | null; // null = expect no tool call at all
  expectedFactsContain?: string[]; // only checked for query_jared_memory cases
};
```

Seed set (~10 cases):

- One positive case per tool: `open_case_study`, `open_resume`,
  `focus_section`, `set_theme`, `trigger_ui_state`, `query_jared_memory`.
- 1-2 plain-conversation prompts with `expectedTool: null`.
- 2 additional `query_jared_memory` cases with `expectedFactsContain` set, to
  catch RAG drift independent of tool-selection correctness.

Deliberately small — every case is a real Gemini + Upstash call, and the
self-throttle (below) makes each additional case cost ~6.5s of wall time.

## Grading

- **Primary (tool selection):** exact match against `expectedTool`, read from
  the `tool-call` parts of the parsed `UIMessage`. Fully deterministic — no
  LLM judge involved.
- **Secondary (RAG accuracy):** for cases with `expectedFactsContain`,
  case-insensitive substring match of each expected string against the
  concatenated `query_jared_memory` tool-result facts. Deterministic and
  free, at the cost of being stricter about exact phrasing than an LLM judge
  would be — acceptable for v1 since it only needs to catch gross drift (a
  fact disappearing or a query returning garbage), not subtle wording
  changes.

## Retry and rate limiting

`/api/chat` rate-limits to 10 requests/min per client IP
(`src/lib/ratelimit.ts` via `chat.ts:46`). An eval run hitting the same local
dev/preview server would trip this limiter mid-run if requests weren't
paced, producing false failures unrelated to agent quality.

Two mechanisms, both living entirely in the eval suite (no changes to
`chat.ts` or `ratelimit.ts` — no new bypass surface in production code):

1. **Self-throttle:** the test file awaits ~6.5s between cases, keeping
   sustained request rate under the 10 req/min cap with headroom.
2. **Retry:** Playwright's `retries: 1` reruns a failed case once. Combined
   with the throttle, a full ~10-case run with zero failures takes
   ~65s; a run with retries takes longer proportionally.

## Reporting

Playwright's `list` reporter — pass/fail per case name to stdout, non-zero
process exit if any case fails after its retry. No `html` reporter (that's
for the e2e suite; keeping eval lightweight and dependency-free avoids
generating report artifacts nobody looks at for a manual-only tool).

## Wiring

`package.json`:

```json
"eval:agent": "playwright test --config=playwright.eval.config.ts"
```

Not added to `preflight` or any CI workflow — manual-only, per the cost and
non-determinism of live model calls. Intended usage: run before merging a
change to `SYSTEM_PROMPT`, a tool definition, or the RAG data/embedding
pipeline.

## Error handling

- If the dev/preview server fails to boot, Playwright's own `webServer`
  timeout (mirrors `playwright.config.ts:37`, 120s) surfaces that failure
  clearly — no custom handling needed.
- If `/api/chat` returns a non-2xx status (e.g. a transient 500), the case
  fails and gets Playwright's normal one retry; no special-casing beyond
  what the retry already provides.
- Missing local env vars (`GOOGLE_GENERATIVE_AI_API_KEY`,
  `UPSTASH_VECTOR_REST_URL`/`TOKEN`, Upstash Redis creds) are already
  required for `npm run dev`/`preview` to serve a working `/api/chat` — the
  eval suite has no separate env-var handling; a missing key surfaces as
  every case failing, which is diagnosable from the first failure's output.

## Testing the harness itself

No meta-tests for the eval harness — it's a thin fixture-driven wrapper
around Playwright's `request` fixture and `ai`'s `readUIMessageStream`, both
already-tested dependencies. Correctness is verified by running
`npm run eval:agent` against the current (working) agent and confirming all
seed cases pass; a case that can't pass against known-good behavior would
indicate a bug in the harness itself, not the agent.
