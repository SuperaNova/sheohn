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

| Command                      | What it does                                                         |
| ---------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                | Start dev server at `http://localhost:4321`                          |
| `npm run build`              | Production build (writes to `.vercel/output/static/` via adapter)    |
| `npm run preview`            | Preview the production build locally                                 |
| `npm run lint`               | ESLint over `src/`                                                   |
| `npm run format`             | Prettier write across the repo                                       |
| `npm run format:check`       | Prettier check (no writes) — what CI runs                            |
| `npm run check`              | `astro check` (TS strict + Astro)                                    |
| `npm run test:unit`          | Vitest in watch mode                                                 |
| `npm run test:unit:coverage` | Vitest single-run with v8 coverage report                            |
| `npm run test:e2e`           | Playwright end-to-end                                                |
| `npm run lighthouse:local`   | Build + Lighthouse audit locally                                     |
| `npm run preflight`          | Full local CI chain: format / lint / check / unit / build / lh / e2e |

### Hooks (managed by Husky)

| Hook       | Fires on     | What it runs                                           |
| ---------- | ------------ | ------------------------------------------------------ |
| pre-commit | `git commit` | `lint-staged` (prettier + eslint on staged files only) |
| pre-push   | `git push`   | `lint` + `check` + `test:unit:coverage`                |

Bypass with `--no-verify` if you need to (rarely).
Run `npm run preflight` before a big push if you want full CI parity locally.

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

## Project layout

```
src/
├── components/        Svelte 5 islands (AgentChat, HeaderNav, HeroSection, ...)
├── content/projects/  MDX case studies (filename = URL slug)
├── content.config.ts  Astro Content Collection schema (Zod)
├── data/              Centralized personal info (bio, experience, socials)
├── layouts/           Astro layouts (BaseLayout with SEO + ClientRouter)
├── lib/               Server helpers (system prompt, inview action)
├── pages/             Routes; api/* are SSR endpoints
└── styles/global.css  Tailwind v4 entry + design tokens
scripts/
├── update-brain.ts    Push facts into Upstash Vector (RAG sync)
└── test-chat.ts       Local smoke test for /api/chat
.config/CLAUDE.md      Agent rules — read before making changes
```

## Agent rules (for AI assistants)

See [`.config/CLAUDE.md`](./.config/CLAUDE.md) for the full set. The short version:

- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) for new components
- Use `var(--color-*)` design tokens from `global.css`; no hardcoded hex
- Native Svelte stores for global state — not Zustand
- No React / Vue / Framer Motion
