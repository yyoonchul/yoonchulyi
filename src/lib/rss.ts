import rss from '@astrojs/rss';
import type { FeedEntry, FeedLanguage } from './feeds';

interface RenderFeedOptions {
  title: string;
  description: string;
  site: URL | string;
  language: FeedLanguage;
  entries: FeedEntry[];
}

/**
 * One place where a feed becomes XML, so all four stay identical in shape and
 * only differ in what they carry.
 */
export function renderFeed({
  title,
  description,
  site,
  language,
  entries,
}: RenderFeedOptions) {
  return rss({
    title,
    description,
    site,
    customData: `<language>${language === 'ko' ? 'ko-KR' : 'en-US'}</language>`,
    items: entries.map((entry) => ({
      title: entry.title,
      description: entry.description,
      pubDate: entry.pubDate,
      link: entry.link,
      // Full body, so a reader (and the newsletter built from this feed) never
      // has to fetch the page to show the post.
      content: entry.content,
    })),
  });
}
