import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const blogCollection = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/blog/content',
  }),
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
    seoTitle: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    datePublished: z.coerce.date().optional(),
    dateModified: z.coerce.date().optional(),
    language: z.enum(['en', 'ko']).optional(),
    tags: z.array(z.string().min(1)).default([]),
    topics: z.array(z.string().min(1)).default([]),
    featured: z.boolean().default(false),
    index: z.boolean().default(true),
  }),
});
