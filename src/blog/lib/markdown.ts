import { createMarkdownProcessor } from '@astrojs/markdown-remark';

let markdownProcessorPromise:
  | ReturnType<typeof createMarkdownProcessor>
  | undefined;

export function getBlogMarkdownProcessor() {
  if (!markdownProcessorPromise) {
    markdownProcessorPromise = createMarkdownProcessor();
  }

  return markdownProcessorPromise;
}
