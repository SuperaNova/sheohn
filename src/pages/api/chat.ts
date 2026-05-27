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

type IncomingMessage = Partial<UIMessage> & {
  role: UIMessage['role'];
  content?: string;
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip =
    clientAddress || request.headers.get('x-forwarded-for') || '127.0.0.1';
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

  const body = (await request.json()) as { messages?: IncomingMessage[] };
  // DefaultChatTransport sends UI messages. Normalize so all have `parts`
  // (first-turn messages may only have `content` without `parts`).
  const rawMessages: UIMessage[] = (body.messages ?? []).map((m) => {
    if (!m.parts) {
      return {
        ...m,
        parts: [{ type: 'text', text: m.content ?? '' }],
      } as UIMessage;
    }
    return m as UIMessage;
  });
  const messages = await convertToModelMessages(rawMessages);

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    system: SYSTEM_PROMPT,
    messages,
    stopWhen: stepCountIs(5),
    tools: {
      trigger_ui_state: tool({
        description:
          'Highlight specific projects on the screen when the user asks about certain technologies.',
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
