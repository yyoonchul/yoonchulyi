/**
 * Pieces the event-driven essay sender and the weekly digest both need:
 * the sent-log, the Resend client, and the env plumbing around them.
 */

import { readFileSync, writeFileSync } from 'node:fs';

export type Language = 'en' | 'ko';

const STATE_PATH = new URL('../../.newsletter-state.json', import.meta.url);

export interface StateEntry {
  key: string;
  title: string;
  sentAt: string;
}

export interface State {
  sent: StateEntry[];
}

export function readState(): State {
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

export function writeState(state: State): void {
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function segmentIdFor(language: Language): string {
  return requireEnv(language === 'ko' ? 'RESEND_SEGMENT_KO' : 'RESEND_SEGMENT_EN');
}

export async function resend(
  path: string,
  apiKey: string,
  body: Record<string, unknown>,
  method: 'POST' | 'DELETE' = 'POST',
): Promise<{ id: string }> {
  const response = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: method === 'DELETE' ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new ResendError(
      `Resend ${path} failed (${response.status}): ${raw}`,
      response.status,
      raw,
    );
    throw error;
  }
  return raw ? (JSON.parse(raw) as { id: string }) : { id: '' };
}

export class ResendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ResendError';
  }

  /**
   * A segment with no subscribers is not a failure — there is simply nobody to
   * mail. Resend reports it as a 422 on send, which used to abort the whole run
   * and leave every later feed unsent.
   */
  get isEmptyAudience(): boolean {
    return this.status === 422 && /has no contacts/i.test(this.body);
  }
}

export interface BroadcastRequest {
  apiKey: string;
  segmentId: string;
  topicId: string;
  from: string;
  replyTo: string;
  name: string;
  subject: string;
  html: string;
  text: string;
}

export type BroadcastOutcome = 'sent' | 'no-contacts';

/**
 * Creates a broadcast and sends it, treating an empty audience as a no-op so a
 * language nobody has subscribed to yet cannot block the other one.
 */
export async function sendBroadcast(request: BroadcastRequest): Promise<BroadcastOutcome> {
  const created = await resend('/broadcasts', request.apiKey, {
    segment_id: request.segmentId,
    topic_id: request.topicId,
    from: request.from,
    reply_to: request.replyTo,
    subject: request.subject,
    name: request.name,
    html: request.html,
    text: request.text,
  });

  try {
    await resend(`/broadcasts/${created.id}/send`, request.apiKey, {});
    return 'sent';
  } catch (error) {
    if (error instanceof ResendError && error.isEmptyAudience) {
      console.warn(`  no contacts in this audience — nothing sent, recorded as delivered`);
      // The unsent draft would otherwise pile up in the Resend dashboard.
      await resend(`/broadcasts/${created.id}`, request.apiKey, {}, 'DELETE').catch(() => {
        console.warn(`  could not clean up unsent broadcast ${created.id}`);
      });
      return 'no-contacts';
    }
    throw error;
  }
}
