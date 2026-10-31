import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const blogCollection = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/blog/content',
  }),
  schema: z.object({
    title: z.string().min(1),
    // Korean feed and newsletter subject fall back to `title` when unset.
    titleKo: z.string().min(1).optional(),
    date: z.coerce.date(),
    // Essays are long, polished pieces; notes are short ones. The type picks
    // the section and so the URL: /essays/<slug>/ or /notes/<slug>/.
    type: z.enum(['essay', 'note']).default('essay'),
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
  }).refine((post) => post.type !== 'essay' || post.description !== undefined, {
    // An essay's summary feeds the search snippet, the share card, the
    // English feed, and the hover preview on /essays/. Without it all of those
    // fall back to a cut-off opening line, so the build refuses the post.
    message:
      'Essays need a `description`: a 140-160 character English summary of what the essay is about.',
    path: ['description'],
  }),
});
