import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import remarkGfm from 'remark-gfm';

let markdownProcessorPromise:
  | ReturnType<typeof createMarkdownProcessor>
  | undefined;

export function getDailyInsightsMarkdownProcessor() {
  if (!markdownProcessorPromise) {
    markdownProcessorPromise = createMarkdownProcessor({
      gfm: false,
      remarkPlugins: [[remarkGfm, { singleTilde: false }]],
    });
  }

  return markdownProcessorPromise;
}
