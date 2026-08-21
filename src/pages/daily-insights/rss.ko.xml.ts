import type { APIContext } from 'astro';
import {
  getDailyInsightFeedEntries,
  getFeedDescription,
  getFeedTitle,
} from '../../lib/feeds';
import { renderFeed } from '../../lib/rss';

export async function GET(context: APIContext) {
  return renderFeed({
    title: getFeedTitle('ko', 'daily'),
    description: getFeedDescription('ko', 'daily'),
    site: context.site!,
    language: 'ko',
    entries: await getDailyInsightFeedEntries('ko'),
  });
}
