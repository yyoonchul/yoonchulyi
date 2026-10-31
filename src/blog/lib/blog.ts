import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';
import {
  getExcerptFromMarkdown,
  stripMarkdownHeading,
  uniqueStrings,
} from '../../lib/seo';

const WHITESPACE_PATTERN = /\s+/g;

const EN_START_MARKER = '<!-- LANG:EN:START -->';
const EN_END_MARKER = '<!-- LANG:EN:END -->';
const KO_START_MARKER = '<!-- LANG:KO:START -->';
const KO_END_MARKER = '<!-- LANG:KO:END -->';

export function getBlogSlugFromTitle(title: string): string {
  return title.trim().replace(WHITESPACE_PATTERN, '-');
}

export function getBlogSlug(post: CollectionEntry<'blog'>): string {
  return post.data.slug ?? getBlogSlugFromTitle(post.data.title);
}

export type BlogPostType = CollectionEntry<'blog'>['data']['type'];

export interface BlogSection {
  type: BlogPostType;
  label: string;
  path: string;
}

// Each post type is its own top-level section, so the type decides the URL.
export const BLOG_SECTIONS: Record<BlogPostType, BlogSection> = {
  essay: { type: 'essay', label: 'Essays', path: '/essays/' },
  note: { type: 'note', label: 'Notes', path: '/notes/' },
};

export function getBlogSection(post: CollectionEntry<'blog'>): BlogSection {
  return BLOG_SECTIONS[post.data.type];
}

export function getBlogHrefFromSlug(type: BlogPostType, slug: string): string {
  return `${BLOG_SECTIONS[type].path}${encodeURIComponent(slug)}/`;
}

export function getBlogHref(post: CollectionEntry<'blog'>): string {
  return getBlogHrefFromSlug(post.data.type, getBlogSlug(post));
}

export async function getBlogPostsByType(
  type: BlogPostType,
): Promise<CollectionEntry<'blog'>[]> {
  return (await getCollection('blog', (post) => post.data.type === type)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

export function formatBlogDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getBlogPublishedDate(post: CollectionEntry<'blog'>): Date {
  return post.data.datePublished ?? post.data.date;
}

export function getBlogModifiedDate(post: CollectionEntry<'blog'>): Date {
  return post.data.dateModified ?? getBlogPublishedDate(post);
}

export function isBlogIndexable(post: CollectionEntry<'blog'>): boolean {
  return post.data.index !== false;
}

export function formatDateForSchema(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getBlogSeoTitle(post: CollectionEntry<'blog'>): string {
  return (
    post.data.seoTitle ??
    `${post.data.title} - ${getBlogSection(post).label} - Yoonchul Yi`
  );
}

export function getBlogDescription(
  post: CollectionEntry<'blog'>,
  content?: BlogBilingualContent,
): string {
  if (post.data.description) {
    return post.data.description;
  }

  const parsedContent = content ?? parseBlogBilingualContent(post);
  const markdown = (parsedContent.enMarkdown || parsedContent.koMarkdown)
    .replace(/^#{1,3}\s+.+$/m, '')
    .trim();
  return getExcerptFromMarkdown(markdown);
}

// Blocks that open a post without being prose: headings, rules, quotes,
// lists, and raw HTML.
const NON_PROSE_BLOCK = /^(#{1,6}\s|-{3,}|\*{3,}|>|[-*+]\s|\d+\.\s|<)/;

/**
 * The first sentence of the post's first prose paragraph, English first. The
 * essay list shows it as the hover preview.
 */
export function getBlogFirstSentence(content: BlogBilingualContent): string {
  const markdown = content.enMarkdown || content.koMarkdown;
  const paragraph = markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block && !NON_PROSE_BLOCK.test(block));
  if (!paragraph) {
    return '';
  }

  const text = stripMarkdownHeading(paragraph.replace(/\[\^[^\]]+\]/g, ''));
  return /^.+?[.!?](?=\s|$)/.exec(text)?.[0] ?? text;
}

export function getBlogKeywords(post: CollectionEntry<'blog'>): string[] {
  return uniqueStrings([
    ...(post.data.tags ?? []),
    ...(post.data.topics ?? []),
  ]);
}

export interface BlogBilingualContent {
  enMarkdown: string;
  koMarkdown: string;
}

export interface BlogPostPageProps {
  post: CollectionEntry<'blog'>;
  slug: string;
  title: string;
  content: BlogBilingualContent;
}

export async function getBlogPostStaticPaths(type: BlogPostType) {
  const posts = await getBlogPostsByType(type);

  return posts.map((post) => {
    const title = post.data.title;
    const slug = getBlogSlug(post);

    return {
      params: { slug },
      props: {
        post,
        slug,
        title,
        content: parseBlogBilingualContent(post),
      } satisfies BlogPostPageProps,
    };
  });
}

function getMarkerIndexOrThrow(
  body: string,
  marker: string,
  entryId: string,
): number {
  const index = body.indexOf(marker);
  if (index === -1) {
    throw new Error(`[blog] Missing marker "${marker}" in ${entryId}.`);
  }
  return index;
}

function countMarkerOccurrences(body: string, marker: string): number {
  if (!marker) {
    return 0;
  }

  return body.split(marker).length - 1;
}

function assertSingleMarkerOccurrence(
  body: string,
  marker: string,
  entryId: string,
) {
  const count = countMarkerOccurrences(body, marker);
  if (count !== 1) {
    throw new Error(
      `[blog] Marker "${marker}" must appear exactly once in ${entryId}. Found: ${count}.`,
    );
  }
}

function assertMarkerOrder(
  positions: { marker: string; index: number }[],
  entryId: string,
) {
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i - 1].index >= positions[i].index) {
      throw new Error(`[blog] Invalid EN/KO marker order in ${entryId}.`);
    }
  }
}

function getSectionBody(
  body: string,
  startMarker: string,
  startIndex: number,
  endIndex: number,
): string {
  const start = startIndex + startMarker.length;
  const rawSection = body.slice(start, endIndex);
  return rawSection.trim();
}

function assertNoContentOutsideLanguageBlocks(
  body: string,
  entryId: string,
  enStartIndex: number,
  enEndIndex: number,
  koStartIndex: number,
  koEndIndex: number,
) {
  const beforeEn = body.slice(0, enStartIndex).trim();
  const betweenBlocks = body
    .slice(enEndIndex + EN_END_MARKER.length, koStartIndex)
    .trim();
  const afterKo = body.slice(koEndIndex + KO_END_MARKER.length).trim();

  if (beforeEn || betweenBlocks || afterKo) {
    throw new Error(
      `[blog] Unexpected content outside EN/KO blocks in ${entryId}.`,
    );
  }
}

export function parseBlogBilingualContent(
  entry: CollectionEntry<'blog'>,
): BlogBilingualContent {
  const body = entry.body?.trim();
  if (!body) {
    throw new Error(`[blog] Empty body in ${entry.id}.`);
  }

  assertSingleMarkerOccurrence(body, EN_START_MARKER, entry.id);
  assertSingleMarkerOccurrence(body, EN_END_MARKER, entry.id);
  assertSingleMarkerOccurrence(body, KO_START_MARKER, entry.id);
  assertSingleMarkerOccurrence(body, KO_END_MARKER, entry.id);

  const enStartIndex = getMarkerIndexOrThrow(body, EN_START_MARKER, entry.id);
  const enEndIndex = getMarkerIndexOrThrow(body, EN_END_MARKER, entry.id);
  const koStartIndex = getMarkerIndexOrThrow(body, KO_START_MARKER, entry.id);
  const koEndIndex = getMarkerIndexOrThrow(body, KO_END_MARKER, entry.id);

  assertMarkerOrder(
    [
      { marker: EN_START_MARKER, index: enStartIndex },
      { marker: EN_END_MARKER, index: enEndIndex },
      { marker: KO_START_MARKER, index: koStartIndex },
      { marker: KO_END_MARKER, index: koEndIndex },
    ],
    entry.id,
  );

  assertNoContentOutsideLanguageBlocks(
    body,
    entry.id,
    enStartIndex,
    enEndIndex,
    koStartIndex,
    koEndIndex,
  );

  const enMarkdown = getSectionBody(
    body,
    EN_START_MARKER,
    enStartIndex,
    enEndIndex,
  );
  const koMarkdown = getSectionBody(
    body,
    KO_START_MARKER,
    koStartIndex,
    koEndIndex,
  );

  return {
    enMarkdown,
    koMarkdown,
  };
}
