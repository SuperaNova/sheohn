/* eslint-disable @typescript-eslint/no-explicit-any */
import { streamText, embed, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import type { APIRoute } from 'astro';
import { Index } from '@upstash/vector';
import { SYSTEM_PROMPT } from '../../lib/prompts';

// Initialize the Vector DB client outside the route so it natively caches on the Edge/Serverless function
const index = new Index({
  url:
    import.meta.env.UPSTASH_VECTOR_REST_URL ||
    process.env.UPSTASH_VECTOR_REST_URL,
  token:
    import.meta.env.UPSTASH_VECTOR_REST_TOKEN ||
    process.env.UPSTASH_VECTOR_REST_TOKEN,
});

export const POST: APIRoute = async ({ request }) => {
  const { messages } = await request.json();

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: SYSTEM_PROMPT,
    messages,
    tools: {
      trigger_ui_state: tool({
        description:
          'Highlight specific projects on the screen when the user asks about certain technologies.',
        parameters: z.object({
          focus: z
            .string()
            .describe(
              'The technology or project to focus on, e.g., "React", "AI", "PostgreSQL"',
            ),
        }),
        // @ts-expect-error: strict type inference mismatch
        execute: async ({ focus }) => {
          return { status: 'triggered', focus };
        },
      }),
      query_jared_memory: tool({
        description:
          "Search Jared's long-term memory vector database for localized facts about his work, skills, and background.",
        parameters: z.object({
          query: z
            .string()
            .describe("The search query to match against Jared's facts."),
        }),
        // @ts-expect-error: strict type inference mismatch
        execute: async ({ query }) => {
          console.log(`[RAG Pipeline] Embedding query: "${query}"`);

          // Embed the user's explicit query to match the math vectors
          const { embedding } = await embed({
            model: google.embeddingModel('gemini-embedding-001'),
            value: query,
            providerOptions: {
              google: {
                outputDimensionality: 1536,
              },
            },
          });

          // Query the top 3 most mathematically relevant facts from Upstash
          const results = await index.query({
            vector: embedding,
            topK: 3,
            includeMetadata: true,
          });

          // Extract just the factual text blocks to feed to the LLM so it can natively read them
          const facts = results.map((r) => r.metadata?.text || 'Unknown fact');
          console.log(
            `[RAG Pipeline] Found ${facts.length} facts from memory.`,
          );

          return facts;
        },
      }),
    },
  });

  return (result as any).toDataStreamResponse
    ? (result as any).toDataStreamResponse()
    : (result as any).toTextStreamResponse();
};
