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

| Command             | What it does                                |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Start dev server at `http://localhost:4321` |
| `npm run build`     | Production build to `./dist/`               |
| `npm run preview`   | Preview the production build locally        |
| `npm run lint`      | ESLint over `src/`                          |
| `npm run format`    | Prettier across the repo                    |
| `npm run check`     | `astro check` (TS strict + Astro)           |
| `npm run test:unit` | Vitest unit tests                           |
| `npm run test:e2e`  | Playwright end-to-end                       |

### Pre-push checklist

Run before every push to keep CI green:

```bash
npm run format
npm run lint
npm run check
```

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
