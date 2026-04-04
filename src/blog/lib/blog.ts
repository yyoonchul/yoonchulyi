import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';

const WHITESPACE_PATTERN = /\s+/g;

const EN_START_MARKER = '<!-- LANG:EN:START -->';
const EN_END_MARKER = '<!-- LANG:EN:END -->';
const KO_START_MARKER = '<!-- LANG:KO:START -->';
const KO_END_MARKER = '<!-- LANG:KO:END -->';

export function getBlogSlugFromTitle(title: string): string {
  return title.trim().replace(WHITESPACE_PATTERN, '-');
}

export function getBlogHrefFromTitle(title: string): string {
  const slug = getBlogSlugFromTitle(title);
  return `/blog/${encodeURIComponent(slug)}/`;
}

export function formatBlogDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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

export async function getBlogPostStaticPaths() {
  const posts = await getCollection('blog');

  return posts.map((post) => {
    const title = post.data.title;
    const slug = getBlogSlugFromTitle(title);

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
