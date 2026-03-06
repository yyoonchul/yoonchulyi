import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(1),
    date: z.coerce.date(),
  }),
});

export const collections = {
  blog,
};
