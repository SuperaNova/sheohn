import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const projectsCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.string(),
    stack: z.array(z.string()),
    role: z.string().optional(),
    timeline: z.string().optional(),
    team: z.string().optional(),
    status: z.string(),
    image: z.string().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(99),
  }),
});

const nowCollection = defineCollection({
  loader: glob({ pattern: 'index.md', base: './src/content/now' }),
  schema: z.object({ updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
});

export const collections = {
  projects: projectsCollection,
  now: nowCollection,
};
