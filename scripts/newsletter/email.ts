/**
 * Turns a feed item's semantic HTML into something a mail client will render.
 *
 * Email clients strip <style> blocks and ignore most selectors, so every rule
 * has to ride on the element itself. The feeds deliberately carry unstyled
 * markup; this is where it gets dressed, and only here.
 */

// Blog posts and digests use no code blocks or images today, so the tag set
// stays small. A tag missing here still renders — just with client defaults.
const TAG_STYLES: Record<string, string> = {
  h1: 'margin:32px 0 8px;font-size:22px;font-weight:500;line-height:1.3;',
  h2: 'margin:32px 0 8px;font-size:19px;font-weight:500;line-height:1.35;',
  h3: 'margin:24px 0 8px;font-size:17px;font-weight:500;line-height:1.4;',
  h4: 'margin:24px 0 8px;font-size:16px;font-weight:500;',
  p: 'margin:0 0 16px;font-size:16px;line-height:1.7;',
  ul: 'margin:0 0 16px;padding-left:22px;',
  ol: 'margin:0 0 16px;padding-left:22px;',
  li: 'margin:0 0 6px;font-size:16px;line-height:1.7;',
  blockquote:
    'margin:0 0 16px;padding:2px 0 2px 16px;border-left:2px solid rgba(140,140,140,0.4);color:#4a4a4a;',
  hr: 'border:none;border-top:1px solid rgba(140,140,140,0.3);margin:32px 0;',
  a: 'color:#EA580C;',
  code: "background:rgba(140,140,140,0.15);padding:1px 4px;font-family:'IBM Plex Mono',monospace;font-size:14px;",
  pre: 'margin:0 0 16px;padding:14px;background:rgba(140,140,140,0.12);overflow-x:auto;font-size:14px;',
  table: 'border-collapse:collapse;margin:0 0 16px;width:100%;',
  th: 'text-align:left;padding:6px 8px;border-bottom:1px solid rgba(140,140,140,0.4);font-size:15px;',
  td: 'padding:6px 8px;border-bottom:1px solid rgba(140,140,140,0.2);font-size:15px;',
  img: 'max-width:100%;height:auto;',
};

export interface EmailCopy {
  footerNote: string;
  unsubscribe: string;
  readOnline: string;
}

export const EMAIL_COPY: Record<'en' | 'ko', EmailCopy> = {
  en: {
    footerNote: 'You are receiving this because you subscribed at yoonchulyi.com.',
    unsubscribe: 'Manage your subscription',
    readOnline: 'Read on the site',
  },
  ko: {
    footerNote: 'yoonchulyi.com 에서 구독하셨기에 보내드리는 메일입니다.',
    unsubscribe: '구독 설정 변경',
    readOnline: '사이트에서 보기',
  },
};

export function inlineStyles(html: string): string {
  return html.replace(/<([a-z][a-z0-9]*)((?:\s[^>]*)?)>/gi, (match, rawTag, attributes) => {
    const tag = String(rawTag).toLowerCase();
    const style = TAG_STYLES[tag];
    if (!style) {
      return match;
    }

    const attrs = String(attributes);
    // Respect a style the markdown already carries rather than dropping it.
    if (/\sstyle\s*=/i.test(attrs)) {
      return `<${rawTag}${attrs.replace(
        /(\sstyle\s*=\s*["'])/i,
        `$1${style}`,
      )}>`;
    }
    return `<${rawTag}${attrs} style="${style}">`;
  });
}

interface RenderOptions {
  language: 'en' | 'ko';
  title: string;
  link: string;
  dateLabel: string;
  bodyHtml: string;
}

export function renderEmailHtml({
  language,
  title,
  link,
  dateLabel,
  bodyHtml,
}: RenderOptions): string {
  const copy = EMAIL_COPY[language];

  return `<!doctype html>
<html lang="${language}">
  <body style="margin:0;padding:32px 16px;background:#F4F4F0;font-family:Georgia,'Times New Roman',serif;color:#191919;line-height:1.7;">
    <div style="max-width:600px;margin:0 auto;">
      <p style="margin:0 0 32px;font-size:13px;color:#8C8C8C;">yoonchulyi.com</p>

      <h1 style="margin:0 0 6px;font-size:25px;font-weight:500;line-height:1.25;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 32px;font-size:12px;color:#8C8C8C;">${escapeHtml(dateLabel)}</p>

      ${inlineStyles(bodyHtml)}

      <hr style="border:none;border-top:1px solid rgba(140,140,140,0.3);margin:40px 0 20px;" />

      <p style="margin:0 0 6px;font-size:12px;color:#8C8C8C;">
        <a href="${link}" style="color:#8C8C8C;">${copy.readOnline}</a>
      </p>
      <p style="margin:0;font-size:12px;color:#8C8C8C;">
        ${copy.footerNote}
        <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#8C8C8C;">${copy.unsubscribe}</a>
      </p>
    </div>
  </body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* -------------------------------------------------------------------------
 * Weekly Daily Insights digest
 *
 * A different shape from a post announcement: a TL;DR up top, then the week's
 * three-bullet summaries grouped by day, each linking back to the full write-up.
 * ---------------------------------------------------------------------- */

export interface WeeklyCopy {
  tldr: string;
  kicker: string;
  readDay: string;
  readAll: string;
  itemCount: (count: number) => string;
}

export const WEEKLY_COPY: Record<'en' | 'ko', WeeklyCopy> = {
  en: {
    tldr: 'TL;DR',
    kicker: 'Daily Insights — the week in review',
    readDay: 'Read the full notes',
    readAll: 'Browse every Daily Insight',
    itemCount: (count) => `${count} ${count === 1 ? 'story' : 'stories'}`,
  },
  ko: {
    tldr: '3줄 요약',
    kicker: '데일리 인사이트 — 이번 주 정리',
    readDay: '전체 정리 보기',
    readAll: '데일리 인사이트 전체 보기',
    itemCount: (count) => `${count}건`,
  },
};

export interface WeeklyDigestArticle {
  title: string;
  meta: string;
  link: string | null;
  bullets: string[];
}

export interface WeeklyDigestDay {
  isoDate: string;
  href: string;
  articles: WeeklyDigestArticle[];
}

interface WeeklyDigestOptions {
  language: 'en' | 'ko';
  subject: string;
  tldr: string[];
  days: WeeklyDigestDay[];
  window: { start: string; end: string };
  archiveUrl: string;
}

export function renderWeeklyDigestHtml({
  language,
  subject,
  tldr,
  days,
  window,
  archiveUrl,
}: WeeklyDigestOptions): string {
  const copy = EMAIL_COPY[language];
  const weekly = WEEKLY_COPY[language];
  const articleCount = days.reduce((total, day) => total + day.articles.length, 0);

  return `<!doctype html>
<html lang="${language}">
  <body style="margin:0;padding:32px 16px;background:#F4F4F0;font-family:Georgia,'Times New Roman',serif;color:#191919;line-height:1.7;">
    <div style="max-width:600px;margin:0 auto;">
      <p style="margin:0 0 32px;font-size:13px;color:#8C8C8C;">yoonchulyi.com</p>

      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#EA580C;">${escapeHtml(weekly.kicker)}</p>
      <h1 style="margin:0 0 6px;font-size:25px;font-weight:500;line-height:1.25;">${escapeHtml(subject)}</h1>
      <p style="margin:0 0 32px;font-size:12px;color:#8C8C8C;">${escapeHtml(formatRange(window, language))} · ${escapeHtml(weekly.itemCount(articleCount))}</p>

      <div style="margin:0 0 40px;padding:20px 22px;background:#EDEDE7;border-left:2px solid #EA580C;">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8C8C8C;">${escapeHtml(weekly.tldr)}</p>
        ${tldr
          .map(
            (line) =>
              `<p style="margin:0 0 10px;font-size:16px;line-height:1.65;">${escapeHtml(line)}</p>`,
          )
          .join('\n        ')}
      </div>

      ${days.map((day) => renderDay(day, language)).join('\n      ')}

      <hr style="border:none;border-top:1px solid rgba(140,140,140,0.3);margin:40px 0 20px;" />

      <p style="margin:0 0 6px;font-size:12px;color:#8C8C8C;">
        <a href="${archiveUrl}" style="color:#8C8C8C;">${escapeHtml(weekly.readAll)}</a>
      </p>
      <p style="margin:0;font-size:12px;color:#8C8C8C;">
        ${copy.footerNote}
        <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#8C8C8C;">${copy.unsubscribe}</a>
      </p>
    </div>
  </body>
</html>`;
}

function renderDay(day: WeeklyDigestDay, language: 'en' | 'ko'): string {
  const weekly = WEEKLY_COPY[language];

  return `<div style="margin:0 0 36px;">
        <p style="margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid rgba(140,140,140,0.3);font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#8C8C8C;">${escapeHtml(formatDay(day.isoDate, language))}</p>
        ${day.articles.map((article) => renderArticle(article)).join('\n        ')}
        <p style="margin:0;font-size:12px;">
          <a href="${day.href}" style="color:#EA580C;">${escapeHtml(weekly.readDay)} →</a>
        </p>
      </div>`;
}

function renderArticle(article: WeeklyDigestArticle): string {
  const heading = article.link
    ? `<a href="${article.link}" style="color:#191919;text-decoration:none;border-bottom:1px solid rgba(234,88,12,0.5);">${escapeHtml(article.title)}</a>`
    : escapeHtml(article.title);

  return `<div style="margin:0 0 24px;">
          <h2 style="margin:0 0 4px;font-size:18px;font-weight:500;line-height:1.35;">${heading}</h2>
          ${article.meta ? `<p style="margin:0 0 10px;font-size:12px;color:#8C8C8C;">${escapeHtml(article.meta)}</p>` : ''}
          <ul style="margin:0;padding-left:20px;">
            ${article.bullets
              .map(
                (bullet) =>
                  `<li style="margin:0 0 8px;font-size:15px;line-height:1.65;">${escapeHtml(bullet)}</li>`,
              )
              .join('\n            ')}
          </ul>
        </div>`;
}

function formatDay(isoDate: string, language: 'en' | 'ko'): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(
    language === 'ko' ? 'ko-KR' : 'en-GB',
    {
      weekday: language === 'ko' ? 'short' : 'long',
      day: 'numeric',
      month: language === 'ko' ? 'numeric' : 'long',
      timeZone: 'UTC',
    },
  );
}

function formatRange(
  window: { start: string; end: string },
  language: 'en' | 'ko',
): string {
  const format = (isoDate: string) =>
    new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(
      language === 'ko' ? 'ko-KR' : 'en-GB',
      {
        day: 'numeric',
        month: language === 'ko' ? 'long' : 'short',
        year: 'numeric',
        timeZone: 'UTC',
      },
    );
  return `${format(window.start)} – ${format(window.end)}`;
}
