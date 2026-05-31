import {
  streamText,
  embed,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { Index } from '@upstash/vector';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { SYSTEM_PROMPT } from '../../lib/prompts';
export const prerender = false;

// Initialize the Vector DB client outside the route so it natively caches on the Edge/Serverless function
const index = new Index({
  url:
    import.meta.env.UPSTASH_VECTOR_REST_URL ||
    process.env.UPSTASH_VECTOR_REST_URL,
  token:
    import.meta.env.UPSTASH_VECTOR_REST_TOKEN ||
    process.env.UPSTASH_VECTOR_REST_TOKEN,
});

const redis = new Redis({
  url:
    import.meta.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_URL,
  token:
    import.meta.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true,
  prefix: 'ratelimit_chat',
});

// Explicitly pass the API key; Astro SSR may not expose process.env to the SDK auto-detector
const google = createGoogleGenerativeAI({
  apiKey:
    import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Incoming message validation. `.passthrough()` on parts keeps the tool-call
// fields the AI SDK resends in assistant history; the message object itself is
// strict-stripped. Roles are restricted to user/assistant so a caller can't
// inject a forged `system` turn to override SYSTEM_PROMPT.
const ChatPartSchema = z.looseObject({
  type: z.string(),
  text: z.string().optional(),
});

const ChatMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant']),
  content: z.string().optional(),
  parts: z.array(ChatPartSchema).max(64).optional(),
});

const ChatBodySchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(24),
});

// Hard cap on the raw request body — a cheap DoS guard so a caller can't
// inflate the LLM context (and the bill) with a giant payload.
const MAX_BODY_BYTES = 32_000;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Only accept JSON POSTs; reject anything else before doing any work.
  if (
    !(request.headers.get('content-type') ?? '').includes('application/json')
  ) {
    return new Response('Unsupported Media Type', { status: 415 });
  }

  // Trust only the platform-derived client address. x-forwarded-for is
  // client-spoofable and would let a caller rotate identities to slip the
  // rate limiter.
  const ip = clientAddress ?? '127.0.0.1';
  const { success, limit, reset, remaining } = await ratelimit.limit(
    `ratelimit_chat_${ip}`,
  );

  if (!success) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
      },
    });
  }

  // Bound the raw payload, then parse.
  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return new Response('Payload Too Large', { status: 413 });
    }
    payload = JSON.parse(raw);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Validate shape + roles (caps message count, blocks injected system turns).
  const parsed = ChatBodySchema.safeParse(payload);
  if (!parsed.success) {
    return new Response('Bad Request', { status: 400 });
  }

  // DefaultChatTransport sends UI messages. Normalize so all have `parts`
  // (first-turn messages may only have `content` without `parts`).
  const rawMessages: UIMessage[] = parsed.data.messages.map((m) => {
    if (!m.parts) {
      return {
        ...m,
        parts: [{ type: 'text', text: m.content ?? '' }],
      } as UIMessage;
    }
    return m as UIMessage;
  });
  const messages = await convertToModelMessages(rawMessages);

  // Pull live case-study slugs so the agent can open the right project page.
  const projectEntries = await getCollection('projects');
  const caseStudies = projectEntries
    .sort((a, b) => a.data.order - b.data.order)
    .map((p) => ({
      slug: p.id,
      title: p.data.title,
      summary: p.data.summary,
    }));
  const caseStudyContext = `\n\nAVAILABLE CASE STUDIES — to open a project's full page, call open_case_study with the EXACT slug:\n${caseStudies
    .map((c) => `- ${c.title} (slug: "${c.slug}") — ${c.summary}`)
    .join('\n')}`;

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    system: SYSTEM_PROMPT + caseStudyContext,
    messages,
    stopWhen: stepCountIs(5),
    tools: {
      open_case_study: tool({
        description:
          "Open the full case-study page for one of Jared's projects. Use when the visitor wants to see, read, or dive into a specific project. Pass the exact slug from the case study list in the system prompt.",
        inputSchema: z.object({
          slug: z.string().describe('The exact case-study slug, e.g. "animo"'),
        }),
        execute: async ({ slug }) => {
          const match = caseStudies.find((c) => c.slug === slug);
          return match
            ? { status: 'opening', slug, title: match.title }
            : {
                status: 'not_found',
                slug,
                available: caseStudies.map((c) => c.slug),
              };
        },
      }),
      focus_section: tool({
        description:
          'Pan the website to a section and spotlight it for the visitor (dims everything else). Call this to physically direct attention BEFORE answering — e.g. when introducing Jared (about), discussing his skills (stack), his work (projects), or how to reach him (contact). Use sparingly: one section per turn.',
        inputSchema: z.object({
          section: z
            .enum(['hero', 'about', 'stack', 'projects', 'contact'])
            .describe(
              'hero = intro, about = bio + experience, stack = tech skills, projects = work, contact = get in touch',
            ),
        }),
        execute: async ({ section }) => {
          return { status: 'focused', section };
        },
      }),
      set_theme: tool({
        description:
          'Switch the site between light and dark mode. Use when the visitor asks to change the theme ("dark mode", "lights off", "make it brighter").',
        inputSchema: z.object({
          mode: z
            .enum(['light', 'dark'])
            .describe('The theme to switch the site to.'),
        }),
        execute: async ({ mode }) => {
          return { status: 'theme_set', mode };
        },
      }),
      trigger_ui_state: tool({
        description:
          'Highlight specific project cards when the user asks about a particular technology.',
        inputSchema: z.object({
          focus: z
            .string()
            .describe(
              'The technology or project to focus on, e.g., "React", "AI", "PostgreSQL"',
            ),
        }),
        execute: async ({ focus }) => {
          return { status: 'triggered', focus };
        },
      }),
      query_jared_memory: tool({
        description:
          "Search Jared's long-term memory vector database for localized facts about his work, skills, and background.",
        inputSchema: z.object({
          query: z
            .string()
            .describe("The search query to match against Jared's facts."),
        }),
        execute: async ({ query }) => {
          console.log(`[RAG Pipeline] Embedding query: "${query}"`);

          const { embedding } = await embed({
            model: google.embeddingModel('gemini-embedding-001'),
            value: query,
            providerOptions: {
              google: {
                outputDimensionality: 1536,
              },
            },
          });

          const results = await index.query({
            vector: embedding,
            topK: 3,
            includeMetadata: true,
          });

          const facts = results.map((r) => r.metadata?.text || 'Unknown fact');
          console.log(
            `[RAG Pipeline] Found ${facts.length} facts from memory.`,
          );

          return facts;
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
};
