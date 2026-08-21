import type { APIContext } from 'astro';
import {
  getBlogFeedEntries,
  getFeedDescription,
  getFeedTitle,
} from '../lib/feeds';
import { renderFeed } from '../lib/rss';

export async function GET(context: APIContext) {
  return renderFeed({
    title: getFeedTitle('ko', 'blog'),
    description: getFeedDescription('ko', 'blog'),
    site: context.site!,
    language: 'ko',
    entries: await getBlogFeedEntries('ko'),
  });
}
