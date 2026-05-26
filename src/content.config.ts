import { defineCollection } from 'astro:content';
import { z } from 'zod';
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

export const collections = {
  projects: projectsCollection,
};
