import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const dailyInsightsCollection = defineCollection({
  loader: glob({
    pattern: '[0-9][0-9][0-9][0-9]/[0-9][0-9]/[0-9][0-9].md',
    base: './src/daily-insights/content',
  }),
  schema: z.object({}).passthrough(),
});
