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
  }),
});
