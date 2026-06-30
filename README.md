# sheohn.dev

Personal portfolio of **Jared Sheohn L. Acebes** — Software Developer & Systems Architect.

Live at [sheohn.dev](https://sheohn.dev).

## Stack

- **Astro 6** (static output, Vercel adapter) with MDX content collections
- **Svelte 5** (runes) for interactive islands
- **Tailwind CSS v4** via `@tailwindcss/vite` (config lives in `src/styles/global.css` under `@theme`)
- **Vercel AI SDK** (`ai` v6 + `@ai-sdk/google` + `@ai-sdk/svelte`) — streaming chat agent backed by Gemini
- **Upstash Vector** for RAG (1536-dim Gemini embeddings)
- **Upstash Redis + Ratelimit** on `/api/chat` and `/api/contact`
- **Resend** for contact-form delivery

## Scripts

| Command                      | What it does                                                               |
| ---------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                | Start dev server at `http://localhost:4321`                                |
| `npm run build`              | Production build (writes to `.vercel/output/static/` via adapter)          |
| `npm run preview`            | Preview the production build locally                                       |
| `npm run lint`               | ESLint over `src/`                                                         |
| `npm run format`             | Prettier write across the repo                                             |
| `npm run format:check`       | Prettier check (no writes) — what CI runs                                  |
| `npm run check`              | `astro check` (TS strict + Astro)                                          |
| `npm run check:svelte`       | `svelte-check` over components (deeper `.svelte` types than `astro check`) |
| `npm run knip`               | Unused files / exports / dependencies                                      |
| `npm run secretlint`         | Scan the repo for committed secrets                                        |
| `npm run test:unit`          | Vitest in watch mode                                                       |
| `npm run test:unit:coverage` | Vitest single-run with v8 coverage report                                  |
| `npm run test:e2e`           | Playwright end-to-end                                                      |
| `npm run lighthouse:local`   | Build + Lighthouse audit locally (desktop)                                 |
| `npm run lighthouse:mobile`  | Lighthouse audit with mobile emulation                                     |
| `npm run preflight`          | Full local CI chain: format / lint / check / unit / build / lh / e2e       |

### Hooks (managed by Husky)

| Hook       | Fires on     | What it runs                                                      |
| ---------- | ------------ | ----------------------------------------------------------------- |
| pre-commit | `git commit` | `lint-staged` (prettier + eslint + secretlint on staged files)    |
| pre-push   | `git push`   | `lint` + `check` + `check:svelte` + `knip` + `test:unit:coverage` |

Bypass with `--no-verify` if you need to (rarely).
Run `npm run preflight` before a big push if you want full CI parity locally.

> **svelte-check** type-checks `.svelte` components deeper than `astro check` does (it catches script-body type errors `astro check` misses). It runs against `tsconfig.svelte-check.json` (the project config minus test files, which `astro check` + the test runners already cover) and is a blocking gate in pre-push and CI.

### Whole-site Lighthouse sweep (optional)

`lhci` (above) gates a fixed list of routes per PR. For an ad-hoc crawl of **every** page at once — handy when adding routes or hunting per-page SEO/a11y gaps — run [unlighthouse](https://unlighthouse.dev) on demand (no install needed):

```bash
npm run dev            # or: npm run preview after a build
npx unlighthouse --site http://localhost:4321
```

It opens an interactive dashboard scoring perf / a11y / best-practices / SEO across the crawled site. Use it as a periodic sweep; `lhci` remains the PR gate.

## Environment

Copy the keys below into a local `.env` (gitignored). All are required for the AI chat + contact flows.

```
GOOGLE_GENERATIVE_AI_API_KEY=
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=
```

```

## AI Chatbot Architecture

The integrated AI assistant allows visitors to query your portfolio and triggers UI changes on the fly. If you want to repurpose this for yourself, here is how the core pieces fit together:

1. **API & LLM Setup (`src/pages/api/chat.ts`)**:
   Uses the Vercel AI SDK to handle streaming from Google Gemini. It includes server-side tool definitions (like `focus_section` and `open_case_study`). It also integrates Upstash Ratelimit and Upstash Vector DB for RAG (Retrieval-Augmented Generation).
2. **Prompts (`src/lib/prompts.ts`)**:
   Contains the `SYSTEM_PROMPT`. Change this to configure the personality, tone, and specific instructions for the agent.
3. **Frontend Agent UI (`src/components/agent/CommandDeck.svelte`)**:
   The chat interface at the bottom of the screen. It intercepts tool calls streaming back from the API and maps them to local state changes (e.g., changing the theme or pushing a command to the `store.ts`).
4. **Agent Action Engine (`src/components/agent/ScenePilot.svelte`)**:
   Listens to commands emitted by the `CommandDeck` (via stores) and actually performs the DOM actions, like scrolling smoothly to a specific section.
5. **State Bridge (`src/store.ts`)**:
   Houses the Svelte stores (`agentQuery`, `sceneCommand`, `routeCommand`) that act as the message bus between the UI and the AI components.

## Project layout

```

src/
├── components/ Svelte 5 islands (AgentChat, HeaderNav, HeroSection, ...)
├── content/projects/ MDX case studies (filename = URL slug)
├── content.config.ts Astro Content Collection schema (Zod)
├── data/ Centralized personal info (bio, experience, socials)
├── layouts/ Astro layouts (BaseLayout with SEO + ClientRouter)
├── lib/ Server helpers (system prompt, inview action)
├── pages/ Routes; api/\* are SSR endpoints
└── styles/global.css Tailwind v4 entry + design tokens
scripts/
├── update-brain.ts Push facts into Upstash Vector (RAG sync)
└── test-chat.ts Local smoke test for /api/chat
.config/CLAUDE.md Agent rules — read before making changes

```

## Agent rules (for AI assistants)

See [`.config/CLAUDE.md`](./.config/CLAUDE.md) for the full set. The short version:

- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) for new components
- Use `var(--color-*)` design tokens from `global.css`; no hardcoded hex
- Native Svelte stores for global state — not Zustand
- No React / Vue / Framer Motion
```
