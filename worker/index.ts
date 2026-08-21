/// <reference types="@cloudflare/workers-types" />

/**
 * Subscription endpoints for the newsletter.
 *
 * Everything outside `/api/*` never reaches this code — `run_worker_first`
 * in wrangler.toml keeps the rest of the site on the static asset path.
 *
 * Confirmation state lives entirely in a signed token rather than storage:
 * the token carries the address and an expiry, and the HMAC makes it
 * unforgeable, so double opt-in needs no database.
 */

interface Env {
  ASSETS: Fetcher;
  RESEND_API_KEY: string;
  RESEND_AUDIENCE_ID: string;
  SUBSCRIBE_SECRET: string;
  SUBSCRIBE_LIMITER: RateLimit;
}

const SITE = 'https://yoonchulyi.com';
// Sending lives on the mail subdomain so bulk reputation never touches the
// root domain; replies come back to the root, which Email Routing forwards.
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

    return env.ASSETS.fetch(request);
  },
};

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const { email, honeypot } = await readSubmission(request);

  // Bots fill every field they find; humans never see this one.
  if (honeypot) {
    return json({ ok: true });
  }

  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(normalized)) {
    return json({ error: 'Enter a valid email address.' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.SUBSCRIBE_LIMITER.limit({ key: ip });
  if (!success) {
    return json({ error: 'Too many requests. Try again in a minute.' }, 429);
  }

  const token = await createToken(normalized, env.SUBSCRIBE_SECRET);
  const confirmUrl = `${SITE}/api/confirm?token=${encodeURIComponent(token)}`;
  await sendConfirmationEmail(normalized, confirmUrl, env);

  return json({ ok: true });
}

async function handleConfirm(url: URL, env: Env): Promise<Response> {
  const token = url.searchParams.get('token') ?? '';
  const email = await verifyToken(token, env.SUBSCRIBE_SECRET);

  if (!email) {
    return Response.redirect(`${SITE}/subscribe/error/`, 302);
  }

  const response = await fetch(
    `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    },
  );

  if (!response.ok) {
    return Response.redirect(`${SITE}/subscribe/error/`, 302);
  }

  return Response.redirect(`${SITE}/subscribe/confirmed/`, 302);
}

async function readSubmission(request: Request): Promise<{ email: string; honeypot: string }> {
  const contentType = request.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      email: typeof body.email === 'string' ? body.email : '',
      honeypot: typeof body.website === 'string' ? body.website : '',
    };
  }

  const form = await request.formData().catch(() => new FormData());
  return {
    email: String(form.get('email') ?? ''),
    honeypot: String(form.get('website') ?? ''),
  };
}

async function sendConfirmationEmail(email: string, confirmUrl: string, env: Env): Promise<void> {
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
      subject: 'Confirm your subscription',
      text: confirmationText(confirmUrl),
      html: confirmationHtml(confirmUrl),
    }),
  });
}

function confirmationText(confirmUrl: string): string {
  return [
    'Please confirm your subscription to Yoonchul Yi.',
    '',
    confirmUrl,
    '',
    'The link expires in 24 hours.',
    "If you did not request this, ignore this email — nothing was subscribed.",
  ].join('\n');
}

function confirmationHtml(confirmUrl: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px;background:#ffffff;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;line-height:1.6;">
    <div style="max-width:480px;margin:0 auto;">
      <p style="margin:0 0 24px;font-size:16px;">Please confirm your subscription to <em>Yoonchul Yi</em>.</p>
      <p style="margin:0 0 24px;">
        <a href="${confirmUrl}" style="display:inline-block;padding:10px 20px;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:15px;">Confirm subscription</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#666;">The link expires in 24 hours.</p>
      <p style="margin:0;font-size:13px;color:#666;">If you did not request this, ignore this email — nothing was subscribed.</p>
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

async function createToken(email: string, secret: string): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${email}:${expiry}`;
  const signature = await sign(payload, secret);
  return `${base64UrlEncode(payload)}.${signature}`;
}

async function verifyToken(token: string, secret: string): Promise<string | null> {
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

  const expected = await sign(payload, secret);
  if (!timingSafeEqual(signature, expected)) {
    return null;
  }

  const separator = payload.lastIndexOf(':');
  const email = payload.slice(0, separator);
  const expiry = Number(payload.slice(separator + 1));
  if (!email || !Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return email;
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
