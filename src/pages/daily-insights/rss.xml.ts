import type { APIContext } from 'astro';
import {
  getDailyInsightFeedEntries,
  getFeedDescription,
  getFeedTitle,
} from '../../lib/feeds';
import { renderFeed } from '../../lib/rss';

export async function GET(context: APIContext) {
  return renderFeed({
    title: getFeedTitle('en', 'daily'),
    description: getFeedDescription('en', 'daily'),
    site: context.site!,
    language: 'en',
    entries: await getDailyInsightFeedEntries('en'),
  });
}
