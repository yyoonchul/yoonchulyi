/**
 * Collects a week of Daily Insights into the shape the weekly letter needs.
 *
 * Only the "Quick Summary" section of each day is used — the three bullets per
 * article. The detailed notes stay on the site; the letter is the index into
 * them, not a copy.
 *
 * Bodies are read from the repository rather than the RSS feed because the
 * source markdown keeps the section structure the letter is built around, which
 * the rendered feed HTML has already flattened. The feed is still consulted to
 * confirm each day is actually live before it is linked.
 */

import { readFileSync } from 'node:fs';
import type { Language } from './shared.ts';

const CONTENT_ROOT = new URL('../../src/daily-insights/content/', import.meta.url);

const LANGUAGE_MARKERS: Record<Language, { start: string; end: string }> = {
  en: { start: '<!-- LANG:EN:START -->', end: '<!-- LANG:EN:END -->' },
  ko: { start: '<!-- LANG:KO:START -->', end: '<!-- LANG:KO:END -->' },
};

// Matches "## 📋 Quick Summary" and "## 📋 간단 요약" without depending on the emoji.
const SUMMARY_HEADING = /^##[^\n]*(?:Quick Summary|간단\s*요약)[^\n]*$/m;

export interface DigestArticle {
  title: string;
  /** "Source · Author · Category", already stripped of markdown. */
  meta: string;
  link: string | null;
  bullets: string[];
}

export interface DigestDay {
  isoDate: string;
  /** Absolute URL of the day's page on the site. */
  href: string;
  articles: DigestArticle[];
}

export interface WeekWindow {
  start: string;
  end: string;
}

/**
 * The seven days ending on the Sunday before the most recent Monday — i.e. the
 * week that just closed. Dates are Seoul dates, which is how Daily Insights are
 * filed.
 */
export function resolveWeekWindow(weekOf?: string): WeekWindow {
  const start = weekOf ? parseIsoDate(weekOf) : previousWeekMonday(todayInSeoul());
  const end = addDays(start, 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function eachDate({ start, end }: WeekWindow): string[] {
  const dates: string[] = [];
  for (let day = parseIsoDate(start); toIsoDate(day) <= end; day = addDays(day, 1)) {
    dates.push(toIsoDate(day));
  }
  return dates;
}

/**
 * Reads every day in the window that exists and has a parseable summary.
 * `isLive` gates linking: a day the site has not published yet is skipped
 * rather than linked to a 404.
 */
export function collectWeek(
  window: WeekWindow,
  language: Language,
  site: string,
  isLive: (href: string) => boolean,
): DigestDay[] {
  const days: DigestDay[] = [];

  for (const isoDate of eachDate(window)) {
    const markdown = readLanguageBlock(isoDate, language);
    if (!markdown) {
      continue;
    }

    const articles = parseQuickSummary(markdown);
    if (articles.length === 0) {
      console.warn(`${isoDate}/${language}: no quick summary found — skipped`);
      continue;
    }

    const href = `${site}/daily-insights/${isoDate.replaceAll('-', '/')}/`;
    if (!isLive(href)) {
      console.warn(`${isoDate}/${language}: not in the live feed yet — skipped`);
      continue;
    }

    days.push({ isoDate, href, articles });
  }

  return days;
}

function readLanguageBlock(isoDate: string, language: Language): string | null {
  const [year, month, day] = isoDate.split('-');
  let body: string;
  try {
    body = readFileSync(new URL(`${year}/${month}/${day}.md`, CONTENT_ROOT), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const { start, end } = LANGUAGE_MARKERS[language];
  const startIndex = body.indexOf(start);
  const endIndex = body.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    console.warn(`${isoDate}/${language}: missing language markers — skipped`);
    return null;
  }

  return body.slice(startIndex + start.length, endIndex).trim();
}

export function parseQuickSummary(markdown: string): DigestArticle[] {
  const heading = SUMMARY_HEADING.exec(markdown);
  if (!heading) {
    return [];
  }

  const afterHeading = markdown.slice(heading.index + heading[0].length);
  // The summary runs until the next second-level heading (the detailed notes).
  const nextSection = /^##\s/m.exec(afterHeading);
  const section = nextSection ? afterHeading.slice(0, nextSection.index) : afterHeading;

  const articles: DigestArticle[] = [];
  let current: DigestArticle | null = null;

  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();

    const articleHeading = /^###\s+(.+)$/.exec(line);
    if (articleHeading) {
      current = { title: stripMarkdown(articleHeading[1]), meta: '', link: null, bullets: [] };
      articles.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith('- ')) {
      current.bullets.push(stripMarkdown(line.slice(2)));
      continue;
    }

    if (!current.meta && line.startsWith('**')) {
      const { meta, link } = parseMetaLine(line);
      current.meta = meta;
      current.link = link;
    }
  }

  return articles.filter(
    (article) => article.bullets.length > 0 && !isFetchFailure(article),
  );
}

/**
 * The digest generator leaves a marker bullet behind when it could not read a
 * source. That is fine on the site, where the link is still useful, but in a
 * letter it reads as a broken entry — so it is left out.
 */
function isFetchFailure(article: DigestArticle): boolean {
  return article.bullets.every((bullet) => /^⚠️/.test(bullet));
}

/**
 * Turns "**Source:** X · **Author:** Y · **Link:** [Original](url)" into the
 * plain "Source: X · Author: Y" plus the URL, in either language — the link
 * segment is identified by its markdown link, not by its label.
 */
function parseMetaLine(line: string): { meta: string; link: string | null } {
  let link: string | null = null;
  const kept: string[] = [];

  for (const segment of line.split('·')) {
    const match = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/.exec(segment);
    if (match) {
      link ??= match[1];
      continue;
    }
    const text = stripMarkdown(segment);
    if (text) {
      kept.push(text);
    }
  }

  return { meta: kept.join(' · '), link };
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function todayInSeoul(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parseIsoDate(parts);
}

function previousWeekMonday(date: Date): Date {
  // getUTCDay(): Sunday is 0, so shift it to the end of the week.
  const offsetFromMonday = (date.getUTCDay() + 6) % 7;
  return addDays(date, -offsetFromMonday - 7);
}

function parseIsoDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Expected a YYYY-MM-DD date, got: ${value}`);
  }
  return new Date(`${value}T00:00:00Z`);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.valueOf() + days * 86_400_000);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
