/**
 * Emails subscribers about blog posts that have not been sent yet.
 *
 * The feed is read over HTTP rather than from `dist/`, so a post is only ever
 * announced once it is actually live — an email whose link 404s cannot be
 * unsent. Already-sent posts are tracked in a state file committed to the repo,
 * which makes the send history reviewable in git and survives a rerun.
 *
 * Usage:
 *   tsx scripts/newsletter/send.ts --seed      mark every current post as sent
 *   tsx scripts/newsletter/send.ts --dry-run   report what would be sent
 *   tsx scripts/newsletter/send.ts             send
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const STATE_PATH = new URL('../../.newsletter-state.json', import.meta.url);
const FEED_URL = process.env.FEED_URL ?? 'https://yoonchulyi.com/rss.xml';
const FROM = process.env.NEWSLETTER_FROM ?? 'Yoonchul Yi <yc@mail.yoonchulyi.com>';
const REPLY_TO = process.env.NEWSLETTER_REPLY_TO ?? 'hi@yoonchulyi.com';
const SITE_NAME = 'yoonchulyi.com';

// A freshly deployed post can 404 on some edges for a few seconds.
const FEED_ATTEMPTS = 5;
const FEED_RETRY_MS = 6000;

interface FeedItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

interface State {
  sent: { guid: string; title: string; sentAt: string }[];
}

async function main() {
  const mode = process.argv.includes('--seed')
    ? 'seed'
    : process.argv.includes('--dry-run')
      ? 'dry-run'
      : 'send';

  const state = readState();
  const items = await fetchFeed();
  const alreadySent = new Set(state.sent.map((entry) => entry.guid));
  const pending = items.filter((item) => !alreadySent.has(item.guid));

  console.log(`feed: ${items.length} posts, ${pending.length} unsent`);

  if (mode === 'seed') {
    // Deliberately records without sending: the first real run must not mail
    // out the entire back catalogue.
    writeState({
      sent: items.map((item) => ({
        guid: item.guid,
        title: item.title,
        sentAt: new Date().toISOString(),
      })),
    });
    console.log(`seeded ${items.length} posts as already sent — nothing emailed`);
    return;
  }

  if (pending.length === 0) {
    console.log('nothing to send');
    return;
  }

  for (const item of pending) {
    console.log(`  - ${item.title}  (${item.link})`);
  }

  if (mode === 'dry-run') {
    console.log('dry run — no email sent, state unchanged');
    return;
  }

  const apiKey = requireEnv('RESEND_API_KEY');
  const segmentId = requireEnv('RESEND_SEGMENT_ID');

  // Oldest first, so a backlog arrives in reading order.
  for (const item of [...pending].reverse()) {
    await sendPost(item, apiKey, segmentId);
    state.sent.push({
      guid: item.guid,
      title: item.title,
      sentAt: new Date().toISOString(),
    });
    // Written after each send so a mid-run failure cannot resend what already
    // went out.
    writeState(state);
    console.log(`sent: ${item.title}`);
  }
}

function readState(): State {
  try {
    const parsed = JSON.parse(readFileSync(STATE_PATH, 'utf8')) as Partial<State>;
    return { sent: parsed.sent ?? [] };
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

async function fetchFeed(): Promise<FeedItem[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= FEED_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(FEED_URL, { headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) {
        throw new Error(`Feed responded ${response.status}`);
      }
      return parseFeed(await response.text());
    } catch (error) {
      lastError = error;
      console.warn(`feed attempt ${attempt}/${FEED_ATTEMPTS} failed: ${String(error)}`);
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
    };
  });
}

async function sendPost(item: FeedItem, apiKey: string, segmentId: string): Promise<void> {
  const created = await resend('/broadcasts', apiKey, {
    segment_id: segmentId,
    from: FROM,
    reply_to: REPLY_TO,
    subject: item.title,
    name: `${formatDate(item.pubDate)} — ${item.title}`,
    html: renderHtml(item),
    text: renderText(item),
  });

  await resend(`/broadcasts/${created.id}/send`, apiKey, {});
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

function formatDate(pubDate: string): string {
  const date = new Date(pubDate);
  if (Number.isNaN(date.valueOf())) {
    return '';
  }
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtml(item: FeedItem): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#F4F4F0;font-family:Georgia,'Times New Roman',serif;color:#191919;line-height:1.7;">
    <div style="max-width:560px;margin:0 auto;">
      <p style="margin:0 0 32px;font-size:13px;color:#8C8C8C;">${SITE_NAME}</p>

      <h1 style="margin:0 0 8px;font-size:24px;font-weight:500;">${escapeHtml(item.title)}</h1>
      <p style="margin:0 0 24px;font-size:12px;color:#8C8C8C;">${formatDate(item.pubDate)}</p>

      <p style="margin:0 0 24px;font-size:16px;">${escapeHtml(item.description)}</p>

      <p style="margin:0 0 32px;">
        <a href="${item.link}" style="color:#EA580C;font-size:16px;">Read the full post &rarr;</a>
      </p>

      <hr style="border:none;border-top:1px solid rgba(140,140,140,0.3);margin:32px 0;" />

      <p style="margin:0;font-size:12px;color:#8C8C8C;">
        You are receiving this because you subscribed at ${SITE_NAME}.
        <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#8C8C8C;">Unsubscribe</a>
      </p>
    </div>
  </body>
</html>`;
}

function renderText(item: FeedItem): string {
  return [
    item.title,
    formatDate(item.pubDate),
    '',
    item.description,
    '',
    `Read the full post: ${item.link}`,
    '',
    `You are receiving this because you subscribed at ${SITE_NAME}.`,
    'Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}',
  ].join('\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
