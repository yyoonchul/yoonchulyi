/// <reference types="@cloudflare/workers-types" />

/**
 * Subscription endpoints for the newsletter.
 *
 * Everything outside `/api/*` never reaches this code — `run_worker_first`
 * in wrangler.toml keeps the rest of the site on the static asset path.
 *
 * Confirmation state lives entirely in a signed token rather than storage:
 * the token carries the address, the chosen language and topics, and an
 * expiry, and the HMAC makes it unforgeable. Signing the preferences (not just
 * the address) is what stops someone editing the confirm link to subscribe
 * another person to something they never asked for.
 */

interface Env {
  ASSETS: Fetcher;
  RESEND_API_KEY: string;
  RESEND_SEGMENT_EN: string;
  RESEND_SEGMENT_KO: string;
  RESEND_TOPIC_ESSAYS: string;
  RESEND_TOPIC_DAILY: string;
  SUBSCRIBE_SECRET: string;
  SUBSCRIBE_LIMITER: RateLimit;
}

type Language = 'en' | 'ko';
type Topic = 'essays' | 'daily';

interface Subscription {
  email: string;
  language: Language;
  topics: Topic[];
}

// Sending lives on the mail subdomain so bulk reputation never touches the
// root domain; replies come back to the root, which Email Routing forwards.
const SITE = 'https://yoonchulyi.com';
const FROM = 'Yoonchul Yi <yc@mail.yoonchulyi.com>';
const REPLY_TO = 'hi@yoonchulyi.com';
const TOKEN_TTL_SECONDS = 60 * 60 * 24;

// Deliberately conservative: this endpoint sends mail on a stranger's
// request, so abuse here costs sending reputation, not just CPU.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/subscribe') {
      return handleSubscribe(request, env);
    }
    if (url.pathname === '/api/confirm') {
      return handleConfirm(url, env);
    }
    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404);
    }

    // /about/ was the combined profile page before it was split. Keep the
    // indexed URL working and hand its ranking to the page that replaced it.
    if (url.pathname === '/about' || url.pathname === '/about/') {
      return Response.redirect(`${SITE}/experiences/`, 301);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const submission = await readSubmission(request);

  // Bots fill every field they find; humans never see this one.
  if (submission.honeypot) {
    return json({ ok: true });
  }

  const email = submission.email.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return json({ error: 'Enter a valid email address.' }, 400);
  }

  const language: Language = submission.language === 'ko' ? 'ko' : 'en';
  const topics = submission.topics.filter(
    (topic): topic is Topic => topic === 'essays' || topic === 'daily',
  );
  if (topics.length === 0) {
    return json({ error: 'Choose at least one thing to receive.' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.SUBSCRIBE_LIMITER.limit({ key: ip });
  if (!success) {
    return json({ error: 'Too many requests. Try again in a minute.' }, 429);
  }

  const token = await createToken({ email, language, topics }, env.SUBSCRIBE_SECRET);
  const confirmUrl = `${SITE}/api/confirm?token=${encodeURIComponent(token)}`;
  await sendConfirmationEmail(email, language, confirmUrl, env);

  return json({ ok: true });
}

async function handleConfirm(url: URL, env: Env): Promise<Response> {
  const token = url.searchParams.get('token') ?? '';
  const subscription = await verifyToken(token, env.SUBSCRIBE_SECRET);

  if (!subscription) {
    return Response.redirect(`${SITE}/subscribe/error/`, 302);
  }

  const segmentId =
    subscription.language === 'ko' ? env.RESEND_SEGMENT_KO : env.RESEND_SEGMENT_EN;
  const topicIds: Record<Topic, string> = {
    essays: env.RESEND_TOPIC_ESSAYS,
    daily: env.RESEND_TOPIC_DAILY,
  };

  const response = await fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: subscription.email,
      unsubscribed: false,
      segments: [{ id: segmentId }],
      topics: subscription.topics.map((topic) => ({
        id: topicIds[topic],
        subscription: 'opt_in',
      })),
    }),
  });

  if (!response.ok) {
    return Response.redirect(`${SITE}/subscribe/error/`, 302);
  }

  return Response.redirect(`${SITE}/subscribe/confirmed/?lang=${subscription.language}`, 302);
}

interface Submission {
  email: string;
  honeypot: string;
  language: string;
  topics: string[];
}

async function readSubmission(request: Request): Promise<Submission> {
  const contentType = request.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      email: typeof body.email === 'string' ? body.email : '',
      honeypot: typeof body.website === 'string' ? body.website : '',
      language: typeof body.language === 'string' ? body.language : 'en',
      topics: Array.isArray(body.topics) ? body.topics.map(String) : [],
    };
  }

  const form = await request.formData().catch(() => new FormData());
  return {
    email: String(form.get('email') ?? ''),
    honeypot: String(form.get('website') ?? ''),
    language: String(form.get('language') ?? 'en'),
    topics: form.getAll('topics').map(String),
  };
}

async function sendConfirmationEmail(
  email: string,
  language: Language,
  confirmUrl: string,
  env: Env,
): Promise<void> {
  const copy = CONFIRMATION_COPY[language];

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: email,
      reply_to: REPLY_TO,
      subject: copy.subject,
      text: [copy.intro, '', confirmUrl, '', copy.expiry, copy.ignore].join('\n'),
      html: confirmationHtml(copy, confirmUrl),
    }),
  });
}

const CONFIRMATION_COPY = {
  en: {
    subject: 'Confirm your subscription',
    intro: 'Please confirm your subscription to Yoonchul Yi.',
    button: 'Confirm subscription',
    expiry: 'The link expires in 24 hours.',
    ignore: 'If you did not request this, ignore this email — nothing was subscribed.',
  },
  ko: {
    subject: '구독 확인',
    intro: '이윤철의 뉴스레터 구독을 확인해 주세요.',
    button: '구독 확인하기',
    expiry: '이 링크는 24시간 후 만료됩니다.',
    ignore: '요청하신 적이 없다면 이 메일을 무시하세요. 구독은 이루어지지 않습니다.',
  },
} as const;

type ConfirmationCopy = (typeof CONFIRMATION_COPY)[Language];

function confirmationHtml(copy: ConfirmationCopy, confirmUrl: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#F4F4F0;font-family:Georgia,'Times New Roman',serif;color:#191919;line-height:1.7;">
    <div style="max-width:480px;margin:0 auto;">
      <p style="margin:0 0 24px;font-size:16px;">${copy.intro}</p>
      <p style="margin:0 0 24px;">
        <a href="${confirmUrl}" style="display:inline-block;padding:10px 20px;background:#191919;color:#F4F4F0;text-decoration:none;font-size:15px;">${copy.button}</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#8C8C8C;">${copy.expiry}</p>
      <p style="margin:0;font-size:13px;color:#8C8C8C;">${copy.ignore}</p>
    </div>
  </body>
</html>`;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function createToken(subscription: Subscription, secret: string): Promise<string> {
  const payload = JSON.stringify({
    e: subscription.email,
    l: subscription.language,
    t: subscription.topics,
    x: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  });
  return `${base64UrlEncode(payload)}.${await sign(payload, secret)}`;
}

async function verifyToken(token: string, secret: string): Promise<Subscription | null> {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  let payload: string;
  try {
    payload = base64UrlDecode(encodedPayload);
  } catch {
    return null;
  }

  if (!timingSafeEqual(signature, await sign(payload, secret))) {
    return null;
  }

  let parsed: { e?: unknown; l?: unknown; t?: unknown; x?: unknown };
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  const expiry = Number(parsed.x);
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) {
    return null;
  }

  const email = typeof parsed.e === 'string' ? parsed.e : '';
  const topics = Array.isArray(parsed.t)
    ? parsed.t.filter((topic): topic is Topic => topic === 'essays' || topic === 'daily')
    : [];
  if (!email || topics.length === 0) {
    return null;
  }

  return {
    email,
    language: parsed.l === 'ko' ? 'ko' : 'en',
    topics,
  };
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function base64UrlEncode(value: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return new TextDecoder().decode(
    Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)),
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
