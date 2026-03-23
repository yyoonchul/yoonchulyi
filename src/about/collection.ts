import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const aboutExperiencesCollection = defineCollection({
  loader: glob({
    pattern: 'experiences/*.md',
    base: './src/about/content',
  }),
  schema: z.object({
    role: z.string().min(1),
    organization: z.string().min(1).optional(),
    organizationHref: z.string().url().optional(),
    period: z.string().min(1),
    order: z.number().int(),
  }),
});

export const aboutProjectsCollection = defineCollection({
  loader: glob({
    pattern: 'projects/*.md',
    base: './src/about/content',
  }),
  schema: z.object({
    title: z.string().min(1),
    href: z.string().url().optional(),
    linkLabel: z.string().min(1).optional(),
    order: z.number().int(),
  }),
});
