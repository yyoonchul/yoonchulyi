import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';

const DAILY_INSIGHT_ID_PATTERN = /^(\d{4})\/(\d{2})\/(\d{2})(?:\.md)?$/;
const EN_START_MARKER = '<!-- LANG:EN:START -->';
const EN_END_MARKER = '<!-- LANG:EN:END -->';
const KO_START_MARKER = '<!-- LANG:KO:START -->';
const KO_END_MARKER = '<!-- LANG:KO:END -->';

export interface DailyInsightMeta {
  year: string;
  month: string;
  day: string;
  isoDate: string;
  href: string;
  sortValue: number;
}

export interface DailyInsightPageProps {
  entry: CollectionEntry<'dailyInsights'>;
  meta: DailyInsightMeta;
  content: DailyInsightBilingualContent;
}

export interface DailyInsightBilingualContent {
  enMarkdown: string;
  koMarkdown: string;
}

export function getDailyInsightHref(meta: Pick<DailyInsightMeta, 'year' | 'month' | 'day'>): string {
  return `/daily-insights/${meta.year}/${meta.month}/${meta.day}/`;
}

export function parseDailyInsightMetaFromId(entryId: string): DailyInsightMeta {
  const match = DAILY_INSIGHT_ID_PATTERN.exec(entryId);
  if (!match) {
    throw new Error(`Invalid daily insight path: ${entryId}`);
  }

  const [, year, month, day] = match;
  const isoDate = `${year}-${month}-${day}`;

  return {
    year,
    month,
    day,
    isoDate,
    href: getDailyInsightHref({ year, month, day }),
    sortValue: Date.UTC(Number(year), Number(month) - 1, Number(day)),
  };
}

export async function getDailyInsightEntriesSorted() {
  const entries = await getCollection('dailyInsights');

  return entries
    .map((entry) => ({
      entry,
      meta: parseDailyInsightMetaFromId(entry.id),
    }))
    .sort((a, b) => b.meta.sortValue - a.meta.sortValue);
}

export async function getDailyInsightStaticPaths() {
  const entries = await getDailyInsightEntriesSorted();

  return entries.map(({ entry, meta }) => ({
    params: {
      year: meta.year,
      month: meta.month,
      day: meta.day,
    },
    props: {
      entry,
      meta,
      content: parseDailyInsightBilingualContent(entry),
    } satisfies DailyInsightPageProps,
  }));
}

function getMarkerIndexOrThrow(
  body: string,
  marker: string,
  entryId: string,
): number {
  const index = body.indexOf(marker);
  if (index === -1) {
    throw new Error(
      `[dailyInsights] Missing marker "${marker}" in ${entryId}.`,
    );
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
      `[dailyInsights] Marker "${marker}" must appear exactly once in ${entryId}. Found: ${count}.`,
    );
  }
}

function assertMarkerOrder(
  positions: { marker: string; index: number }[],
  entryId: string,
) {
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i - 1].index >= positions[i].index) {
      throw new Error(
        `[dailyInsights] Invalid EN/KO marker order in ${entryId}.`,
      );
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
      `[dailyInsights] Unexpected content outside EN/KO blocks in ${entryId}.`,
    );
  }
}

export function parseDailyInsightBilingualContent(
  entry: CollectionEntry<'dailyInsights'>,
): DailyInsightBilingualContent {
  const body = entry.body?.trim();
  if (!body) {
    throw new Error(`[dailyInsights] Empty body in ${entry.id}.`);
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

  if (!enMarkdown || !koMarkdown) {
    throw new Error(
      `[dailyInsights] Empty EN or KO section in ${entry.id}.`,
    );
  }

  return {
    enMarkdown,
    koMarkdown,
  };
}
