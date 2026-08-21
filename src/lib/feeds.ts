/**
 * Shared source for the four RSS feeds (blog and Daily Insights, each in
 * English and Korean) and, through them, the newsletter.
 *
 * Feeds carry full post bodies as plain semantic HTML. Styling is deliberately
 * left out: feed readers apply their own, and the newsletter inlines its own
 * styles at send time, so the two consumers want opposite things.
 */

import { getCollection } from 'astro:content';
import {
  getBlogHref,
  getBlogPublishedDate,
  isBlogIndexable,
  parseBlogBilingualContent,
} from '../blog/lib/blog';
import { getBlogMarkdownProcessor } from '../blog/lib/markdown';
import {
  getDailyInsightEntriesSorted,
  parseDailyInsightBilingualContent,
} from '../daily-insights/lib/dailyInsights';
import { getAbsoluteUrl, getExcerptFromMarkdown, stripMarkdownHeading } from './seo';

export type FeedLanguage = 'en' | 'ko';

export interface FeedEntry {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  content: string;
}

// Daily Insights accumulate indefinitely, and each carries a full body, so the
// feed keeps a recent window instead of the whole archive.
const DAILY_INSIGHT_FEED_LIMIT = 20;

export function getFeedTitle(language: FeedLanguage, section: 'blog' | 'daily'): string {
  if (section === 'blog') {
    return language === 'ko' ? 'Yoonchul Yi — 글' : 'Yoonchul Yi';
  }
  return language === 'ko' ? 'Yoonchul Yi — 데일리 인사이트' : 'Yoonchul Yi — Daily Insights';
}

export function getFeedDescription(language: FeedLanguage, section: 'blog' | 'daily'): string {
  if (section === 'blog') {
    return language === 'ko'
      ? 'AI 네이티브 생산성, 로컬 우선 노트, Claude Code 워크플로우, 창업에 대한 이윤철의 글.'
      : 'Long-form essays by Yoonchul Yi on AI-native productivity, local-first notes, Claude Code workflows, startups, and personal operating systems.';
  }
  return language === 'ko'
    ? 'AI, 개발자 도구, 스타트업, 생산성에 대한 매일의 정리.'
    : 'Daily curated notes on AI, DevTools, startups, productivity, and technology.';
}

export async function getBlogFeedEntries(language: FeedLanguage): Promise<FeedEntry[]> {
  const processor = await getBlogMarkdownProcessor();
  const posts = (await getCollection('blog'))
    .filter(isBlogIndexable)
    .sort((a, b) => getBlogPublishedDate(b).valueOf() - getBlogPublishedDate(a).valueOf());

  const entries: FeedEntry[] = [];

  for (const post of posts) {
    const parsed = parseBlogBilingualContent(post);
    const markdown = language === 'ko' ? parsed.koMarkdown : parsed.enMarkdown;
    if (!markdown.trim()) {
      continue;
    }

    entries.push({
      title: language === 'ko' ? (post.data.titleKo ?? post.data.title) : post.data.title,
      link: getAbsoluteUrl(getBlogHref(post)),
      description: post.data.description ?? getExcerptFromMarkdown(markdown),
      pubDate: getBlogPublishedDate(post),
      content: (await processor.render(markdown)).code,
    });
  }

  return entries;
}

export async function getDailyInsightFeedEntries(
  language: FeedLanguage,
): Promise<FeedEntry[]> {
  const processor = await getBlogMarkdownProcessor();
  const sorted = (await getDailyInsightEntriesSorted()).slice(0, DAILY_INSIGHT_FEED_LIMIT);

  const entries: FeedEntry[] = [];

  for (const { entry, meta } of sorted) {
    const parsed = parseDailyInsightBilingualContent(entry);
    const markdown = language === 'ko' ? parsed.koMarkdown : parsed.enMarkdown;
    if (!markdown.trim()) {
      continue;
    }

    entries.push({
      title: getHeadingTitle(markdown, meta.isoDate, language),
      link: getAbsoluteUrl(meta.href),
      description: getExcerptFromMarkdown(markdown),
      pubDate: new Date(`${meta.isoDate}T00:00:00Z`),
      content: (await processor.render(markdown)).code,
    });
  }

  return entries;
}

function getHeadingTitle(
  markdown: string,
  isoDate: string,
  language: FeedLanguage,
): string {
  const heading = /^#\s+(.+)$/m.exec(markdown)?.[1];
  if (heading) {
    return stripMarkdownHeading(heading);
  }
  return language === 'ko' ? `데일리 인사이트 — ${isoDate}` : `Daily Insights — ${isoDate}`;
}
