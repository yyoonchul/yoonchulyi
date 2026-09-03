/**
 * Emails subscribers about essays that have not been sent yet.
 *
 * Two feeds are checked — English and Korean — and each maps to one segment
 * (language) and the essays topic. Feeds are read over HTTP rather than from
 * `dist/`, so a post is only ever announced once it is actually live: an email
 * whose link 404s cannot be unsent.
 *
 * Daily Insights are not sent from here. They go out once a week from
 * `weekly.ts`, which runs on its own schedule rather than on deploy.
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

import { mkdirSync, writeFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { EMAIL_COPY, htmlToText, renderEmailHtml } from './email.ts';
import {
  readState,
  requireEnv,
  segmentIdFor,
  sendBroadcast,
  writeState,
  type Language,
  type StateEntry,
} from './shared.ts';

const SITE = process.env.SITE_URL ?? 'https://yoonchulyi.com';
const FROM = process.env.NEWSLETTER_FROM ?? 'Yoonchul Yi <yc@mail.yoonchulyi.com>';
const REPLY_TO = process.env.NEWSLETTER_REPLY_TO ?? 'hi@yoonchulyi.com';

// A freshly deployed post can 404 on some edges for a few seconds.
const FEED_ATTEMPTS = 5;
const FEED_RETRY_MS = 6000;

// Gmail clips a message past ~102KB behind a "view entire message" link, which
// buries the footer and the unsubscribe link with it.
const GMAIL_CLIP_BYTES = 102_000;

interface FeedSource {
  language: Language;
  path: string;
}

const FEEDS: FeedSource[] = [
  { language: 'en', path: '/rss.xml' },
  { language: 'ko', path: '/rss.ko.xml' },
];

interface FeedItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  content: string;
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
    console.log(`essays/${feed.language}: ${items.length} in feed, ${pending.length} unsent`);
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
      // Oldest first, so a backlog is previewed in reading order.
      const { html, subject, bytes } = buildEmail([...items].reverse()[0], feed);
      const file = `${outDir}/essays-${feed.language}.html`;
      writeFileSync(file, html);
      console.log(`preview: ${file}  (${bytes} bytes)  subject: ${subject}`);
    }
    console.log('preview only — no email sent, state unchanged');
    return;
  }

  const apiKey = requireEnv('RESEND_API_KEY');
  const topicId = requireEnv('RESEND_TOPIC_ESSAYS');

  for (const { feed, items } of plan) {
    // Oldest first, so a backlog arrives in reading order.
    for (const item of [...items].reverse()) {
      const { html, subject } = buildEmail(item, feed);

      const outcome = await sendBroadcast({
        apiKey,
        segmentId: segmentIdFor(feed.language),
        topicId,
        from: FROM,
        replyTo: REPLY_TO,
        name: `${formatDate(item.pubDate, 'en')} — essays/${feed.language}`,
        subject,
        html,
        text: `${htmlToText(html)}\n\n${EMAIL_COPY[feed.language].unsubscribe}: {{{RESEND_UNSUBSCRIBE_URL}}}`,
      });

      state.sent.push({
        key: stateKey(item, feed),
        title: item.title,
        sentAt: new Date().toISOString(),
      });
      // Written after each send so a mid-run failure cannot resend what has
      // already gone out.
      writeState(state);
      console.log(`${outcome} essays/${feed.language}: ${item.title}`);
    }
  }
}

function stateKey(item: FeedItem, feed: FeedSource): string {
  return `${item.guid}|${feed.language}`;
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

function buildEmail(
  item: FeedItem,
  feed: FeedSource,
): { html: string; subject: string; bytes: number } {
  const shared = {
    language: feed.language,
    title: item.title,
    link: item.link,
    dateLabel: formatDate(item.pubDate, feed.language),
  };

  let html = renderEmailHtml({
    ...shared,
    bodyHtml: item.content || `<p>${item.description}</p>`,
  });

  // Falling back to an excerpt keeps the footer — and the unsubscribe link
  // inside it — from disappearing behind Gmail's clip.
  if (Buffer.byteLength(html, 'utf8') > GMAIL_CLIP_BYTES) {
    console.warn(
      `  oversized (${Buffer.byteLength(html, 'utf8')} bytes) — falling back to an excerpt`,
    );
    html = renderEmailHtml({ ...shared, bodyHtml: `<p>${item.description}</p>` });
  }

  return { html, subject: item.title, bytes: Buffer.byteLength(html, 'utf8') };
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
