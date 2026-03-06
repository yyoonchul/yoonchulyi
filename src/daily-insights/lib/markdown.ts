import { createMarkdownProcessor } from '@astrojs/markdown-remark';

let markdownProcessorPromise:
  | ReturnType<typeof createMarkdownProcessor>
  | undefined;

export function getDailyInsightsMarkdownProcessor() {
  if (!markdownProcessorPromise) {
    markdownProcessorPromise = createMarkdownProcessor();
  }

  return markdownProcessorPromise;
}
