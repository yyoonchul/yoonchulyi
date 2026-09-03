/**
 * Sends one Daily Insights letter per week instead of one per day.
 *
 * Runs in two phases so that an agent is responsible for as little as possible:
 *
 *   plan   collect the week's published summaries and write a working directory
 *   ↓      an agent reads the brief and writes headline.json — the subject line
 *   ↓      and the three TL;DR lines, and nothing else
 *   send   render both letters from that and hand them to Resend
 *
 * The body is assembled verbatim from what was already published, so the only
 * new prose in the letter is the part the agent writes. Everything else — which
 * days are in scope, which are live, what the markup looks like, who receives
 * it, what has already gone out — is decided here.
 *
 * Usage:
 *   tsx scripts/newsletter/weekly.ts plan [--week-of YYYY-MM-DD] [--force]
 *   tsx scripts/newsletter/weekly.ts send [--week-of YYYY-MM-DD] [--dry-run|--preview]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { htmlToText, renderWeeklyDigestHtml } from './email.ts';
import { collectWeek, resolveWeekWindow, type DigestDay, type WeekWindow } from './digest.ts';
import {
  LANGUAGES,
  briefPath,
  headlinePath,
  placeholderHeadline,
  readHeadline,
  readPlan,
  workspaceDir,
  writePlan,
  type WeeklyHeadline,
} from './workspace.ts';
import {
  readState,
  requireEnv,
  segmentIdFor,
  sendBroadcast,
  writeState,
  type Language,
} from './shared.ts';

const SITE = process.env.SITE_URL ?? 'https://yoonchulyi.com';
const FROM = process.env.NEWSLETTER_FROM ?? 'Yoonchul Yi <yc@mail.yoonchulyi.com>';
const REPLY_TO = process.env.NEWSLETTER_REPLY_TO ?? 'hi@yoonchulyi.com';

const FEED_PATHS: Record<Language, string> = {
  en: '/daily-insights/rss.xml',
  ko: '/daily-insights/rss.ko.xml',
};

// A freshly deployed post can 404 on some edges for a few seconds.
const FEED_ATTEMPTS = 5;
const FEED_RETRY_MS = 6000;

// Gmail clips a message past ~102KB behind a "view entire message" link, which
// buries the footer and the unsubscribe link with it.
const GMAIL_CLIP_BYTES = 102_000;

async function main() {
  const command = process.argv[2];
  const window = resolveWeekWindow(readOption('--week-of'));

  switch (command) {
    case 'plan':
      return plan(window);
    case 'send':
      return send(window);
    default:
      console.error(
        'Usage: weekly.ts <plan|send> [--week-of YYYY-MM-DD] [--force] [--dry-run] [--preview]',
      );
      process.exit(2);
  }
}

/**
 * Prints `KEY=value` lines as well as prose, so the automation wrapper can read
 * the outcome without parsing sentences.
 */
async function plan(window: WeekWindow) {
  console.log(`week of ${window.start} → ${window.end}`);
  report('WEEK_START', window.start);
  report('WEEK_END', window.end);

  const alreadySent = LANGUAGES.filter((language) => hasSent(window, language));
  if (alreadySent.length === LANGUAGES.length && !process.argv.includes('--force')) {
    console.log('this week has already been sent — pass --force to rebuild the plan anyway');
    return report('STATUS', 'already-sent');
  }

  const weeks = {} as Record<Language, DigestDay[]>;
  for (const language of LANGUAGES) {
    const live = await fetchFeedLinks(`${SITE}${FEED_PATHS[language]}`);
    weeks[language] = collectWeek(window, language, SITE, (href) => live.has(href));
    const articles = weeks[language].reduce((total, day) => total + day.articles.length, 0);
    console.log(`  ${language}: ${weeks[language].length} day(s), ${articles} article(s)`);
  }

  if (LANGUAGES.every((language) => weeks[language].length === 0)) {
    console.log('no Daily Insights published this week — nothing to send');
    return report('STATUS', 'empty');
  }

  writePlan({ window, weeks });
  report('STATUS', 'ready');
  report('WORKDIR', workspaceDir(window));
  report('BRIEF', briefPath(window));
  report('HEADLINE', headlinePath(window));
}

async function send(window: WeekWindow) {
  const mode = process.argv.includes('--preview')
    ? 'preview'
    : process.argv.includes('--dry-run')
      ? 'dry-run'
      : 'send';

  const { weeks } = readPlan(window);
  const headline = resolveHeadline(window, weeks, mode);
  console.log(`week of ${window.start} → ${window.end} (${mode})`);
  console.log(`lead story: ${headline.lead}`);

  if (mode === 'preview') {
    const outDir = process.env.PREVIEW_DIR ?? '.newsletter-preview';
    mkdirSync(outDir, { recursive: true });
    for (const language of LANGUAGES) {
      if (weeks[language].length === 0) continue;
      const { html, subject } = build(language, weeks[language], window, headline);
      const file = `${outDir}/weekly-${language}.html`;
      writeFileSync(file, html);
      console.log(
        `preview: ${file}  (${Buffer.byteLength(html, 'utf8')} bytes)  subject: ${subject}`,
      );
    }
    console.log('preview only — no email sent, state unchanged');
    return;
  }

  const state = readState();
  const pending = LANGUAGES.filter(
    (language) => weeks[language].length > 0 && !hasSent(window, language),
  );

  if (pending.length === 0) {
    console.log('this week has already been sent — nothing to do');
    return;
  }

  if (mode === 'dry-run') {
    for (const language of pending) {
      const { subject } = build(language, weeks[language], window, headline);
      console.log(`would send ${language}: ${subject}`);
    }
    console.log('dry run — no email sent, state unchanged');
    return;
  }

  const apiKey = requireEnv('RESEND_API_KEY');
  const topicId = requireEnv('RESEND_TOPIC_DAILY');

  for (const language of pending) {
    const { html, subject } = build(language, weeks[language], window, headline);

    const outcome = await sendBroadcast({
      apiKey,
      segmentId: segmentIdFor(language),
      topicId,
      from: FROM,
      replyTo: REPLY_TO,
      name: `${window.start} — weekly/${language}`,
      subject,
      html,
      text: htmlToText(html),
    });

    state.sent.push({
      key: stateKey(window, language),
      title: subject,
      sentAt: new Date().toISOString(),
    });
    // Written after each send so a mid-run failure cannot resend what has
    // already gone out.
    writeState(state);
    console.log(`${outcome} weekly/${language}: ${subject}`);
  }
}

function stateKey(window: WeekWindow, language: Language): string {
  return `weekly:${window.start}|${language}`;
}

function hasSent(window: WeekWindow, language: Language): boolean {
  const key = stateKey(window, language);
  return readState().sent.some((entry) => entry.key === key);
}

function resolveHeadline(
  window: WeekWindow,
  weeks: Record<Language, DigestDay[]>,
  mode: string,
): WeeklyHeadline {
  if (mode !== 'preview') {
    return readHeadline(window);
  }
  try {
    return readHeadline(window);
  } catch (error) {
    console.warn(`${String(error)}\npreviewing with placeholder subject and TL;DR instead`);
    return placeholderHeadline(weeks);
  }
}

function build(
  language: Language,
  days: DigestDay[],
  window: WeekWindow,
  headline: WeeklyHeadline,
): { html: string; subject: string } {
  const subject = headline.subject[language];
  const html = renderWeeklyDigestHtml({
    language,
    subject,
    tldr: headline.tldr[language],
    days,
    window,
    archiveUrl: `${SITE}/daily-insights/`,
  });

  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > GMAIL_CLIP_BYTES) {
    console.warn(
      `  ${language} letter is ${bytes} bytes — Gmail will clip it and hide the unsubscribe link`,
    );
  }

  return { html, subject };
}

function report(key: string, value: string): void {
  console.log(`${key}=${value}`);
}

function readOption(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

/** The set of Daily Insight URLs the live feed currently carries. */
async function fetchFeedLinks(url: string): Promise<Set<string>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= FEED_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) {
        throw new Error(`Feed responded ${response.status}`);
      }
      const parsed = new XMLParser({ ignoreAttributes: false }).parse(await response.text());
      const raw = parsed?.rss?.channel?.item;
      const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return new Set(items.map((item: Record<string, unknown>) => String(item.link ?? '')));
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
