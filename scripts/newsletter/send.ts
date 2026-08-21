/**
 * Emails subscribers about posts that have not been sent yet.
 *
 * Four feeds are checked — essays and Daily Insights, each in English and
 * Korean — and each maps to one segment (language) and one topic (what they
 * opted into). Feeds are read over HTTP rather than from `dist/`, so a post is
 * only ever announced once it is actually live: an email whose link 404s
 * cannot be unsent.
 *
 * Sends are recorded in a state file committed to the repo, keyed by URL and
 * language, so the history is reviewable in git and a rerun is a no-op.
 *
 * Usage:
 *   tsx scripts/newsletter/send.ts --seed      mark everything current as sent
 *   tsx scripts/newsletter/send.ts --dry-run   report what would be sent
 *   tsx scripts/newsletter/send.ts --preview   write the next email per feed to disk
 *   tsx scripts/newsletter/send.ts             send
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { EMAIL_COPY, htmlToText, renderEmailHtml } from './email.ts';

const STATE_PATH = new URL('../../.newsletter-state.json', import.meta.url);
const SITE = process.env.SITE_URL ?? 'https://yoonchulyi.com';
const FROM = process.env.NEWSLETTER_FROM ?? 'Yoonchul Yi <yc@mail.yoonchulyi.com>';
const REPLY_TO = process.env.NEWSLETTER_REPLY_TO ?? 'hi@yoonchulyi.com';

// A freshly deployed post can 404 on some edges for a few seconds.
const FEED_ATTEMPTS = 5;
const FEED_RETRY_MS = 6000;

// Gmail clips a message past ~102KB behind a "view entire message" link, which
// buries the footer and the unsubscribe link with it.
const GMAIL_CLIP_BYTES = 102_000;

type Language = 'en' | 'ko';
type Section = 'essays' | 'daily';

interface FeedSource {
  section: Section;
  language: Language;
  path: string;
  /** Several pending items go out as one email rather than a burst. */
  batch: boolean;
}

const FEEDS: FeedSource[] = [
  { section: 'essays', language: 'en', path: '/rss.xml', batch: false },
  { section: 'essays', language: 'ko', path: '/rss.ko.xml', batch: false },
  { section: 'daily', language: 'en', path: '/daily-insights/rss.xml', batch: true },
  { section: 'daily', language: 'ko', path: '/daily-insights/rss.ko.xml', batch: true },
];

interface FeedItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  content: string;
}

interface StateEntry {
  key: string;
  title: string;
  sentAt: string;
}

interface State {
  sent: StateEntry[];
}

async function main() {
  const mode = process.argv.includes('--seed')
    ? 'seed'
    : process.argv.includes('--preview')
      ? 'preview'
      : process.argv.includes('--dry-run')
        ? 'dry-run'
        : 'send';

  const state = readState();
  const seen = new Set(state.sent.map((entry) => entry.key));
  const plan: { feed: FeedSource; items: FeedItem[] }[] = [];

  for (const feed of FEEDS) {
    const items = await fetchFeed(`${SITE}${feed.path}`);
    const pending = items.filter((item) => !seen.has(stateKey(item, feed)));
    console.log(
      `${feed.section}/${feed.language}: ${items.length} in feed, ${pending.length} unsent`,
    );
    for (const item of pending) {
      console.log(`  - ${item.title}`);
    }
    if (pending.length > 0) {
      plan.push({ feed, items: pending });
    }
  }

  if (mode === 'seed') {
    // Records without sending: the first real run must not mail the archive.
    const sent: StateEntry[] = [];
    for (const { feed, items } of plan) {
      for (const item of items) {
        sent.push({
          key: stateKey(item, feed),
          title: item.title,
          sentAt: new Date().toISOString(),
        });
      }
    }
    writeState({ sent: [...state.sent, ...sent] });
    console.log(`seeded ${sent.length} entries as already sent — nothing emailed`);
    return;
  }

  if (plan.length === 0) {
    console.log('nothing to send');
    return;
  }

  if (mode === 'dry-run') {
    console.log('dry run — no email sent, state unchanged');
    return;
  }

  if (mode === 'preview') {
    const outDir = process.env.PREVIEW_DIR ?? '.newsletter-preview';
    mkdirSync(outDir, { recursive: true });
    for (const { feed, items } of plan) {
      const ordered = [...items].reverse();
      const group = feed.batch ? ordered : [ordered[0]];
      const { html, subject, bytes } = buildEmail(group, feed);
      const file = `${outDir}/${feed.section}-${feed.language}.html`;
      writeFileSync(file, html);
      console.log(`preview: ${file}  (${bytes} bytes)  subject: ${subject}`);
    }
    console.log('preview only — no email sent, state unchanged');
    return;
  }

  const apiKey = requireEnv('RESEND_API_KEY');

  for (const { feed, items } of plan) {
    const segmentId = requireEnv(
      feed.language === 'ko' ? 'RESEND_SEGMENT_KO' : 'RESEND_SEGMENT_EN',
    );
    const topicId = requireEnv(
      feed.section === 'daily' ? 'RESEND_TOPIC_DAILY' : 'RESEND_TOPIC_ESSAYS',
    );

    // Oldest first, so a backlog arrives in reading order.
    const ordered = [...items].reverse();
    const groups = feed.batch ? [ordered] : ordered.map((item) => [item]);

    for (const group of groups) {
      await sendGroup(group, feed, { apiKey, segmentId, topicId });
      for (const item of group) {
        state.sent.push({
          key: stateKey(item, feed),
          title: item.title,
          sentAt: new Date().toISOString(),
        });
      }
      // Written after each send so a mid-run failure cannot resend what has
      // already gone out.
      writeState(state);
      console.log(`sent ${feed.section}/${feed.language}: ${group.length} item(s)`);
    }
  }
}

function stateKey(item: FeedItem, feed: FeedSource): string {
  return `${item.guid}|${feed.language}`;
}

function readState(): State {
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf8')) as {
      sent?: (StateEntry | { guid?: string; title?: string; sentAt?: string })[];
    };
    const sent = (parsed.sent ?? []).map((entry) => {
      if ('key' in entry && entry.key) {
        return entry as StateEntry;
      }
      // Pre-language state recorded English-only blog sends.
      const legacy = entry as { guid?: string; title?: string; sentAt?: string };
      return {
        key: `${legacy.guid ?? ''}|en`,
        title: legacy.title ?? '',
        sentAt: legacy.sentAt ?? new Date().toISOString(),
      };
    });
    return { sent };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { sent: [] };
    }
    throw error;
  }
}

function writeState(state: State): void {
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function fetchFeed(url: string): Promise<FeedItem[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= FEED_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) {
        throw new Error(`Feed responded ${response.status}`);
      }
      return parseFeed(await response.text());
    } catch (error) {
      lastError = error;
      console.warn(`feed attempt ${attempt}/${FEED_ATTEMPTS} for ${url} failed: ${String(error)}`);
      if (attempt < FEED_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, FEED_RETRY_MS));
      }
    }
  }

  throw lastError;
}

function parseFeed(xml: string): FeedItem[] {
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
  const rawItems = parsed?.rss?.channel?.item;
  const list = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return list.map((item: Record<string, unknown>) => {
    const link = String(item.link ?? '');
    const guidValue = item.guid;
    const guid =
      typeof guidValue === 'object' && guidValue !== null
        ? String((guidValue as Record<string, unknown>)['#text'] ?? link)
        : String(guidValue ?? link);

    return {
      guid,
      link,
      title: String(item.title ?? 'Untitled'),
      description: String(item.description ?? ''),
      pubDate: String(item.pubDate ?? ''),
      content: String(item['content:encoded'] ?? ''),
    };
  });
}

interface SendContext {
  apiKey: string;
  segmentId: string;
  topicId: string;
}

function buildEmail(
  group: FeedItem[],
  feed: FeedSource,
): { html: string; subject: string; bytes: number } {
  const lead = group[group.length - 1];
  const subject = buildSubject(group, feed);
  const shared = {
    language: feed.language,
    title: subject,
    link: lead.link,
    dateLabel: formatDate(lead.pubDate, feed.language),
  };

  let html = renderEmailHtml({
    ...shared,
    bodyHtml: group
      .map((item) =>
        group.length > 1
          ? `<h1>${item.title}</h1>\n${item.content || `<p>${item.description}</p>`}`
          : item.content || `<p>${item.description}</p>`,
      )
      .join('\n<hr />\n'),
  });

  // Falling back to an excerpt keeps the footer — and the unsubscribe link
  // inside it — from disappearing behind Gmail's clip.
  if (Buffer.byteLength(html, 'utf8') > GMAIL_CLIP_BYTES) {
    console.warn(
      `  oversized (${Buffer.byteLength(html, 'utf8')} bytes) — falling back to excerpts`,
    );
    html = renderEmailHtml({
      ...shared,
      bodyHtml: group
        .map((item) => `<h1>${item.title}</h1>\n<p>${item.description}</p>`)
        .join('\n<hr />\n'),
    });
  }

  return { html, subject, bytes: Buffer.byteLength(html, 'utf8') };
}

async function sendGroup(
  group: FeedItem[],
  feed: FeedSource,
  context: SendContext,
): Promise<void> {
  const lead = group[group.length - 1];
  const { html, subject } = buildEmail(group, feed);

  const created = await resend('/broadcasts', context.apiKey, {
    segment_id: context.segmentId,
    topic_id: context.topicId,
    from: FROM,
    reply_to: REPLY_TO,
    subject,
    name: `${formatDate(lead.pubDate, 'en')} — ${feed.section}/${feed.language}`,
    html,
    text: `${htmlToText(html)}\n\n${EMAIL_COPY[feed.language].unsubscribe}: {{{RESEND_UNSUBSCRIBE_URL}}}`,
  });

  await resend(`/broadcasts/${created.id}/send`, context.apiKey, {});
}

function buildSubject(group: FeedItem[], feed: FeedSource): string {
  if (group.length === 1) {
    return group[0].title;
  }
  return feed.language === 'ko'
    ? `데일리 인사이트 — ${group.length}건`
    : `Daily Insights — ${group.length} updates`;
}

async function resend(
  path: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  const response = await fetch(`https://api.resend.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Resend ${path} failed (${response.status}): ${raw}`);
  }
  return JSON.parse(raw) as { id: string };
}

function formatDate(pubDate: string, language: Language): string {
  const date = new Date(pubDate);
  if (Number.isNaN(date.valueOf())) {
    return '';
  }
  return date.toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-GB', {
    day: 'numeric',
    month: language === 'ko' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
