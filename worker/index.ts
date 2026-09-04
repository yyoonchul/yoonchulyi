/// <reference types="@cloudflare/workers-types" />

/**
 * Subscription endpoints for the newsletter, plus the password gate on /admin/.
 *
 * Only the paths listed in `run_worker_first` in wrangler.toml reach this
 * code; the rest of the site is served straight from the CDN.
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
  ADMIN_PASSWORD: string;
  ADMIN_SECRET: string;
  ADMIN_LIMITER: RateLimit;
  CF_ACCOUNT_ID: string;
  CF_RUM_SITE_TAG: string;
  CF_ANALYTICS_TOKEN: string;
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

// A browser session, not a remember-me. The admin pages read the Resend
// account, so a stale cookie on a shared machine is the thing to avoid.
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12;
const ADMIN_COOKIE = 'admin_session';

// Resend keeps 30 days of history on this plan, so every number below is a
// snapshot of that window and nothing older exists to ask for.
const RESEND = 'https://api.resend.com';
const RESEND_PAGE_SIZE = 100;
const EMAIL_PAGE_LIMIT = 5;
const CONTACT_PAGE_LIMIT = 5;
// Topics are only readable one contact at a time, and the account is capped at
// 10 requests/second. Past this many contacts the topic split is dropped
// rather than spending the whole rate limit on it.
const TOPIC_LOOKUP_LIMIT = 100;
const TOPIC_CONCURRENCY = 4;
const BROADCAST_PAGE_LIMIT = 5;
// The id goes into a URL path upstream, so it is matched rather than trusted.
const BROADCAST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// Page analytics come from Cloudflare Web Analytics, the only first-party
// source that knows which page was viewed and where the visitor came from —
// the zone datasets stop at request counts, and the Worker itself never sees
// an ordinary page request because the CDN answers those on its own.
//
// It is a browser beacon, so what it counts is real browsers running
// JavaScript: crawlers and feed readers never appear, and neither does anyone
// blocking the script. Treat every number here as a floor.
const CF_GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
const RUM_RANGES = { '1d': 1, '7d': 7, '30d': 30 } as const;
const RUM_ROWS = 12;
// 30 days of hourly buckets is 720; the cap leaves room and bounds the query.
const RUM_HOUR_LIMIT = 800;
// A referral from our own pages is a real pageview but not a source of one.
const OWN_HOSTS = new Set(['yoonchulyi.com', 'www.yoonchulyi.com']);

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
    if (url.pathname === '/api/admin/login') {
      return handleAdminLogin(request, env);
    }
    if (url.pathname === '/api/admin/logout') {
      return handleAdminLogout();
    }
    if (url.pathname === '/api/admin/stats') {
      return handleAdminStats(request, env);
    }
    if (url.pathname === '/api/admin/traffic') {
      return handleAdminTraffic(request, env, url);
    }
    if (url.pathname.startsWith('/api/admin/broadcasts/')) {
      return handleAdminBroadcast(
        request,
        env,
        url.pathname.slice('/api/admin/broadcasts/'.length),
      );
    }
    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'Not found' }, 404);
    }

    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      return handleAdmin(request, env);
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

/**
 * The gate on every /admin/* request.
 *
 * The pages themselves are ordinary static assets, so the Worker has to sit in
 * front of them — `run_worker_first` in wrangler.toml is what guarantees the
 * CDN never hands one out on its own. Without a valid session we return the
 * login form under the requested URL rather than redirecting, so signing in
 * lands you back where you were.
 */
async function handleAdmin(request: Request, env: Env): Promise<Response> {
  if (await hasAdminSession(request, env)) {
    const asset = await env.ASSETS.fetch(request);
    return withAdminHeaders(new Response(asset.body, asset));
  }

  const next = new URL(request.url).pathname;
  return withAdminHeaders(
    new Response(loginHtml('', next), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
  );
}

async function handleAdminLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const form = await request.formData().catch(() => new FormData());
  const next = String(form.get('next') ?? '');

  // Guessing a password is cheap; this is what makes it expensive.
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const { success } = await env.ADMIN_LIMITER.limit({ key: ip });
  if (!success) {
    return withAdminHeaders(
      new Response(loginHtml('Too many attempts. Try again in a minute.', next), {
        status: 429,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    );
  }

  const password = String(form.get('password') ?? '');

  if (!(await passwordMatches(password, env))) {
    return withAdminHeaders(
      new Response(loginHtml('Wrong password.', next), {
        status: 401,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    );
  }

  const target = adminRedirectTarget(next);
  const response = new Response(null, {
    status: 303,
    headers: { Location: target },
  });
  response.headers.set('Set-Cookie', await adminCookie(env));
  return withAdminHeaders(response);
}

/**
 * Everything the newsletter tab shows, in one request.
 *
 * Resend's aggregate `metrics` endpoints are still private beta, so the counts
 * here are derived from the plain list endpoints instead. The API key never
 * leaves the Worker — the browser only ever sees what is rendered.
 */
async function handleAdminStats(request: Request, env: Env): Promise<Response> {
  if (!(await hasAdminSession(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const [subscribers, emails, broadcasts] = await Promise.all([
    settle(() => subscriberStats(env)),
    settle(() => emailStats(env)),
    settle(() => broadcastStats(env)),
  ]);

  return withAdminHeaders(
    json({
      fetched_at: new Date().toISOString(),
      retention_days: 30,
      subscribers,
      emails,
      broadcasts,
    }),
  );
}

/** One issue, fetched when its row in the broadcast list is opened. */
async function handleAdminBroadcast(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  if (!(await hasAdminSession(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!BROADCAST_ID_PATTERN.test(id)) {
    return json({ error: 'Not found' }, 404);
  }

  return withAdminHeaders(json(await settle(() => broadcastDetail(id, env))));
}

/**
 * The page analytics tab.
 *
 * Answers 200 with `configured: false` rather than an error when the
 * Cloudflare credentials are absent, because "this needs setting up" is a
 * different thing to say than "the request failed" and the page says both.
 */
async function handleAdminTraffic(request: Request, env: Env, url: URL): Promise<Response> {
  if (!(await hasAdminSession(request, env))) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const asked = url.searchParams.get('range') ?? '7d';
  const range: RumRange = asked in RUM_RANGES ? (asked as RumRange) : '7d';

  // Naming both when only one is missing sends you looking for the wrong thing:
  // the account id is a var in wrangler.toml and the token is a secret, so the
  // two are fixed in different places and only one of them needs a deploy.
  const missing = [
    env.CF_ACCOUNT_ID ? '' : 'CF_ACCOUNT_ID',
    env.CF_ANALYTICS_TOKEN ? '' : 'CF_ANALYTICS_TOKEN',
  ].filter(Boolean);

  if (missing.length) {
    return withAdminHeaders(
      json({
        configured: false,
        range,
        missing,
        reason: `The Worker is missing ${missing.join(' and ')}.`,
      }),
    );
  }

  const until = new Date();
  const since = new Date(until.getTime() - RUM_RANGES[range] * 24 * 60 * 60 * 1000);
  const traffic = await settle(() => rumTraffic(range, since, until, env));

  return withAdminHeaders(
    json({
      configured: true,
      fetched_at: until.toISOString(),
      range,
      since: since.toISOString(),
      until: until.toISOString(),
      traffic,
    }),
  );
}

/** One failing upstream call should cost you that panel, not the whole page. */
async function settle<T>(load: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await load();
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : 'Request failed' };
  }
}

// ---------------------------------------------------------------------------
// Cloudflare Web Analytics
// ---------------------------------------------------------------------------

type RumRange = keyof typeof RUM_RANGES;

interface RumGroup {
  count?: number;
  sum?: { visits?: number };
  dimensions?: Record<string, string>;
}

interface TrafficRow {
  label: string;
  pageviews: number;
  visits: number;
}

/**
 * Every breakdown the tab shows, in one GraphQL request.
 *
 * The dataset is grouped, so each alias below is the same window sliced by a
 * different dimension; asking for them separately would be the same work over
 * six round trips. `datetimeHour` is the finest bucket available and is rolled
 * up here rather than upstream, which is what lets one query serve both the
 * hourly view of a day and the daily view of a month.
 */
async function rumTraffic(range: RumRange, since: Date, until: Date, env: Env) {
  const siteTag = env.CF_RUM_SITE_TAG?.trim() ?? '';

  // Restricting to a site tag is optional: with a single Web Analytics site
  // there is nothing else in the account for the query to pick up.
  const filter = siteTag
    ? '{ AND: [{ datetime_geq: $since }, { datetime_leq: $until }, { siteTag: $siteTag }] }'
    : '{ AND: [{ datetime_geq: $since }, { datetime_leq: $until }] }';

  const breakdown = (alias: string, dimension: string, limit: number) => `
      ${alias}: rumPageloadEventsAdaptiveGroups(
        limit: ${limit}
        filter: ${filter}
        orderBy: [count_DESC]
      ) {
        count
        sum { visits }
        dimensions { ${dimension} }
      }`;

  const query = `query AdminTraffic($accountTag: String!, $since: Time!, $until: Time!${
    siteTag ? ', $siteTag: String!' : ''
  }) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      totals: rumPageloadEventsAdaptiveGroups(limit: 1, filter: ${filter}) {
        count
        sum { visits }
      }
      hours: rumPageloadEventsAdaptiveGroups(
        limit: ${RUM_HOUR_LIMIT}
        filter: ${filter}
        orderBy: [datetimeHour_ASC]
      ) {
        count
        sum { visits }
        dimensions { datetimeHour }
      }${breakdown('pages', 'requestPath', RUM_ROWS)}${breakdown(
        'referrers',
        'refererHost',
        RUM_ROWS * 2,
      )}${breakdown('countries', 'countryName', RUM_ROWS)}${breakdown(
        'devices',
        'deviceType',
        8,
      )}${breakdown('browsers', 'userAgentBrowser', 8)}${breakdown(
        'systems',
        'userAgentOS',
        8,
      )}
    }
  }
}`;

  const variables: Record<string, string> = {
    accountTag: env.CF_ACCOUNT_ID,
    since: since.toISOString(),
    until: until.toISOString(),
  };
  if (siteTag) {
    variables.siteTag = siteTag;
  }

  const response = await fetch(CF_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`Cloudflare returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: { viewer?: { accounts?: Record<string, RumGroup[]>[] } };
    errors?: { message?: string }[];
  };
  if (payload.errors?.length) {
    // Almost always the token: `viewer.accounts` needs Account Analytics Read,
    // and a zone-scoped token fails here rather than at the door.
    throw new Error(payload.errors[0]?.message ?? 'GraphQL request failed');
  }

  const account = payload.data?.viewer?.accounts?.[0];
  if (!account) {
    throw new Error('No account in the response — check CF_ACCOUNT_ID.');
  }

  const totals = account.totals?.[0];
  const hours = account.hours ?? [];

  return {
    totals: {
      pageviews: totals?.count ?? 0,
      visits: totals?.sum?.visits ?? 0,
    },
    series: {
      granularity: range === '1d' ? 'hour' : ('day' as const),
      points: rollUp(hours, range === '1d' ? 13 : 10),
    },
    pages: rumRows(account.pages, 'requestPath'),
    referrers: splitReferrers(rumRows(account.referrers, 'refererHost')),
    countries: rumRows(account.countries, 'countryName'),
    devices: rumRows(account.devices, 'deviceType'),
    browsers: rumRows(account.browsers, 'userAgentBrowser'),
    systems: rumRows(account.systems, 'userAgentOS'),
  };
}

function rumRows(groups: RumGroup[] | undefined, dimension: string): TrafficRow[] {
  return (groups ?? []).map((group) => ({
    label: group.dimensions?.[dimension] ?? '',
    pageviews: group.count ?? 0,
    visits: group.sum?.visits ?? 0,
  }));
}

/**
 * Hourly buckets into whatever the chart is drawing. `width` is how much of
 * the timestamp identifies a bucket: 13 characters is "2026-08-23T14", 10 is
 * the date — so the same rows serve an hourly day and a daily month.
 */
function rollUp(groups: RumGroup[], width: number): TrafficRow[] {
  const buckets = new Map<string, TrafficRow>();

  for (const group of groups) {
    const stamp = group.dimensions?.datetimeHour ?? '';
    if (!stamp) {
      continue;
    }
    const key = stamp.slice(0, width);
    const bucket = buckets.get(key) ?? { label: key, pageviews: 0, visits: 0 };
    bucket.pageviews += group.count ?? 0;
    bucket.visits += group.sum?.visits ?? 0;
    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Our own pages fold into the direct bucket rather than being dropped: an
 * internal link is a real pageview, it just is not somewhere a visitor came
 * from, and discarding it would make the sources add up to less than the
 * traffic they are meant to explain.
 */
function splitReferrers(rows: TrafficRow[]) {
  let direct = 0;
  const external: TrafficRow[] = [];

  for (const row of rows) {
    if (!row.label || OWN_HOSTS.has(row.label)) {
      direct += row.pageviews;
    } else {
      external.push(row);
    }
  }

  return { direct, external: external.slice(0, RUM_ROWS) };
}

// ---------------------------------------------------------------------------
// Resend
// ---------------------------------------------------------------------------

async function resendGet<T>(path: string, env: Env): Promise<T> {
  const response = await fetch(`${RESEND}${path}`, {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
  });
  if (!response.ok) {
    // The path is safe to surface; the key it was signed with is not.
    throw new Error(`Resend returned ${response.status} for ${path.split('?')[0]}`);
  }
  return (await response.json()) as T;
}

interface ResendPage<T> {
  data?: T[];
  has_more?: boolean;
}

/**
 * Cursor pagination with a page cap. The cap is what stops a large account
 * from turning one button press into hundreds of upstream requests; when it
 * bites, `truncated` says so rather than quietly under-reporting.
 */
async function resendList<T extends { id: string }>(
  path: string,
  env: Env,
  maxPages: number,
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  let after = '';

  for (let page = 0; page < maxPages; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const query = `${path}${separator}limit=${RESEND_PAGE_SIZE}${
      after ? `&after=${encodeURIComponent(after)}` : ''
    }`;
    const body = await resendGet<ResendPage<T>>(query, env);
    const batch = body.data ?? [];
    items.push(...batch);

    if (!body.has_more || batch.length === 0) {
      return { items, truncated: false };
    }
    after = batch[batch.length - 1].id;
  }

  return { items, truncated: true };
}

interface ResendContact {
  id: string;
  email: string;
  created_at?: string;
  unsubscribed?: boolean;
}

interface RosterContact {
  id: string;
  email: string;
  created_at: string;
  unsubscribed: boolean;
  language: Language | 'unknown';
  topics: Topic[] | null;
}

type TopicNote = 'ok' | 'skipped' | 'failed';

/**
 * The contact list, annotated with the two things the list endpoint will not
 * return alongside it: which language a contact chose, and which topics they
 * opted into.
 *
 * Language is membership in the two segments the subscribe flow writes to, so
 * it costs two extra list calls. Topics have no bulk endpoint at all — one
 * request per contact — so they are only attempted while the list is short
 * enough that the account's rate limit can absorb it, and their absence is
 * reported rather than shown as zero.
 *
 * Built once per request and read twice: the summary counts and the subscriber
 * table are two views of the same fetch.
 */
async function loadRoster(env: Env) {
  const [contacts, en, ko] = await Promise.all([
    resendList<ResendContact>('/contacts', env, CONTACT_PAGE_LIMIT),
    segmentMembers(env.RESEND_SEGMENT_EN, env),
    segmentMembers(env.RESEND_SEGMENT_KO, env),
  ]);

  const active = contacts.items.filter((contact) => !contact.unsubscribed);
  let topics: Map<string, Topic[]> | null = null;
  let note: TopicNote = 'skipped';

  if (active.length <= TOPIC_LOOKUP_LIMIT) {
    const looked = await settle(() => topicsByContact(active, env));
    if (looked instanceof Map) {
      topics = looked;
      note = 'ok';
    } else {
      note = 'failed';
    }
  }

  const rows: RosterContact[] = contacts.items.map((contact) => ({
    id: contact.id,
    email: contact.email,
    created_at: contact.created_at ?? '',
    unsubscribed: Boolean(contact.unsubscribed),
    language: en.ids.has(contact.id) ? 'en' : ko.ids.has(contact.id) ? 'ko' : 'unknown',
    topics: topics?.get(contact.id) ?? null,
  }));

  // Newest first: the useful question of a subscriber list is who just joined.
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    rows,
    truncated: contacts.truncated || en.truncated || ko.truncated,
    note,
  };
}

async function segmentMembers(
  segmentId: string,
  env: Env,
): Promise<{ ids: Set<string>; truncated: boolean }> {
  if (!segmentId) {
    return { ids: new Set<string>(), truncated: false };
  }
  const { items, truncated } = await resendList<ResendContact>(
    `/segments/${segmentId}/contacts`,
    env,
    CONTACT_PAGE_LIMIT,
  );
  return { ids: new Set(items.map((item) => item.id)), truncated };
}

interface ResendTopic {
  id: string;
  subscription?: string;
}

/** essays vs daily, a few contacts at a time so the rate limit holds. */
async function topicsByContact(
  contacts: ResendContact[],
  env: Env,
): Promise<Map<string, Topic[]>> {
  const labels = new Map<string, Topic>();
  if (env.RESEND_TOPIC_ESSAYS) {
    labels.set(env.RESEND_TOPIC_ESSAYS, 'essays');
  }
  if (env.RESEND_TOPIC_DAILY) {
    labels.set(env.RESEND_TOPIC_DAILY, 'daily');
  }

  const byContact = new Map<string, Topic[]>();
  const queue = [...contacts];

  const worker = async () => {
    for (let contact = queue.pop(); contact; contact = queue.pop()) {
      const body = await resendGet<ResendPage<ResendTopic>>(
        `/contacts/${contact.id}/topics`,
        env,
      );
      const opted: Topic[] = [];
      for (const topic of body.data ?? []) {
        const label = labels.get(topic.id);
        if (label && topic.subscription === 'opt_in') {
          opted.push(label);
        }
      }
      byContact.set(contact.id, opted);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(TOPIC_CONCURRENCY, contacts.length) }, worker),
  );

  return byContact;
}

async function subscriberStats(env: Env) {
  const roster = await loadRoster(env);
  const active = roster.rows.filter((row) => !row.unsubscribed);

  const languages = { en: 0, ko: 0, unknown: 0 };
  const topics = { essays: 0, daily: 0 };
  for (const row of active) {
    languages[row.language] += 1;
    for (const topic of row.topics ?? []) {
      topics[topic] += 1;
    }
  }

  return {
    total: roster.rows.length,
    active: active.length,
    unsubscribed: roster.rows.length - active.length,
    truncated: roster.truncated,
    languages,
    topics: { ...topics, note: roster.note },
    contacts: roster.rows,
  };
}

interface ResendEmail {
  id: string;
  to?: string[];
  subject?: string;
  created_at?: string;
  last_event?: string;
}

/**
 * `last_event` records only the furthest stage an email reached, so the funnel
 * is reconstructed by rolling later stages back into earlier ones: anything
 * that was opened was necessarily delivered. The one place this under-counts
 * is a spam complaint, which overwrites `opened` — hence `complained` counting
 * toward delivered but not toward opened.
 */
async function emailStats(env: Env) {
  const { items, truncated } = await resendList<ResendEmail>(
    '/emails',
    env,
    EMAIL_PAGE_LIMIT,
  );

  const byEvent: Record<string, number> = {};
  for (const email of items) {
    const event = email.last_event ?? 'unknown';
    byEvent[event] = (byEvent[event] ?? 0) + 1;
  }
  const total = (...events: string[]) =>
    events.reduce((sum, event) => sum + (byEvent[event] ?? 0), 0);

  return {
    sent: items.length,
    truncated,
    by_event: byEvent,
    delivered: total('delivered', 'opened', 'clicked', 'complained'),
    opened: total('opened', 'clicked'),
    clicked: total('clicked'),
    bounced: total('bounced'),
    complained: total('complained'),
    failed: total('failed'),
    pending: total('sent', 'queued', 'scheduled', 'delivery_delayed'),
    recent: items.slice(0, 10).map((email) => ({
      id: email.id,
      to: email.to?.[0] ?? '',
      subject: email.subject ?? '',
      created_at: email.created_at ?? '',
      last_event: email.last_event ?? 'unknown',
    })),
  };
}

interface ResendBroadcast {
  id: string;
  name?: string;
  subject?: string;
  status?: string;
  created_at?: string;
  scheduled_at?: string | null;
  sent_at?: string | null;
}

/** Every issue, newest first — the list endpoint returns them unordered. */
async function broadcastStats(env: Env) {
  const { items, truncated } = await resendList<ResendBroadcast>(
    '/broadcasts',
    env,
    BROADCAST_PAGE_LIMIT,
  );

  const ordered = [...items].sort((a, b) =>
    (b.sent_at ?? b.created_at ?? '').localeCompare(a.sent_at ?? a.created_at ?? ''),
  );

  return {
    total: items.length,
    sent: items.filter((broadcast) => broadcast.sent_at).length,
    truncated,
    issues: ordered.map((broadcast) => ({
      id: broadcast.id,
      name: broadcast.name ?? '(untitled)',
      subject: broadcast.subject ?? '',
      status: broadcast.status ?? 'unknown',
      created_at: broadcast.created_at ?? '',
      scheduled_at: broadcast.scheduled_at ?? null,
      sent_at: broadcast.sent_at ?? null,
    })),
  };
}

interface ResendBroadcastDetail extends ResendBroadcast {
  from?: string;
  reply_to?: string | string[] | null;
  preview_text?: string;
  segment_id?: string;
  audience_id?: string;
  topic_id?: string;
  html?: string;
  text?: string;
}

/**
 * What one issue was: who it went to, what it said, when it left. The body is
 * cut down to an excerpt here rather than in the browser — sending a whole
 * newsletter over the wire to show its first paragraph is the kind of thing
 * that only shows up as a slow page much later.
 */
async function broadcastDetail(id: string, env: Env) {
  const broadcast = await resendGet<ResendBroadcastDetail>(`/broadcasts/${id}`, env);

  const segmentId = broadcast.segment_id ?? broadcast.audience_id ?? '';
  const segments: Record<string, string> = {
    [env.RESEND_SEGMENT_EN]: 'EN',
    [env.RESEND_SEGMENT_KO]: 'KO',
  };
  const topics: Record<string, string> = {
    [env.RESEND_TOPIC_ESSAYS]: 'essays',
    [env.RESEND_TOPIC_DAILY]: 'daily',
  };

  return {
    id: broadcast.id,
    name: broadcast.name ?? '(untitled)',
    subject: broadcast.subject ?? '',
    from: broadcast.from ?? '',
    preview_text: broadcast.preview_text ?? '',
    status: broadcast.status ?? 'unknown',
    created_at: broadcast.created_at ?? '',
    scheduled_at: broadcast.scheduled_at ?? null,
    sent_at: broadcast.sent_at ?? null,
    segment: segmentId ? (segments[segmentId] ?? segmentId) : '',
    topic: broadcast.topic_id ? (topics[broadcast.topic_id] ?? broadcast.topic_id) : '',
    excerpt: excerpt(broadcast.text ?? stripTags(broadcast.html ?? '')),
  };
}

function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
}

function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 480 ? `${flat.slice(0, 480)}…` : flat;
}

function handleAdminLogout(): Response {
  const response = new Response(null, {
    status: 303,
    headers: { Location: '/admin/' },
  });
  response.headers.set(
    'Set-Cookie',
    `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
  );
  return withAdminHeaders(response);
}

/**
 * Only ever send the browser back to a path on this site. `next` arrives from
 * a form field, so an attacker could otherwise use the login page as an open
 * redirect onto a lookalike domain.
 *
 * Relative on purpose: the site answers on both the apex and www, and an
 * absolute redirect would hand the browser to the other host, where the
 * session cookie it was just given does not exist.
 */
function adminRedirectTarget(next: string): string {
  if (next.startsWith('/admin/') && !next.startsWith('//')) {
    return next;
  }
  return '/admin/';
}

async function passwordMatches(candidate: string, env: Env): Promise<boolean> {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return false;
  }
  const [a, b] = await Promise.all([
    sign(candidate, env.ADMIN_SECRET),
    sign(env.ADMIN_PASSWORD, env.ADMIN_SECRET),
  ]);
  return timingSafeEqual(a, b);
}

async function adminCookie(env: Env): Promise<string> {
  const payload = JSON.stringify({
    x: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
  });
  const token = `${base64UrlEncode(payload)}.${await sign(payload, env.ADMIN_SECRET)}`;
  return [
    `${ADMIN_COOKIE}=${token}`,
    'Path=/',
    `Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ');
}

async function hasAdminSession(request: Request, env: Env): Promise<boolean> {
  if (!env.ADMIN_SECRET) {
    return false;
  }

  const token = readCookie(request.headers.get('Cookie') ?? '', ADMIN_COOKIE);
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return false;
  }

  let payload: string;
  try {
    payload = base64UrlDecode(encodedPayload);
  } catch {
    return false;
  }

  if (!timingSafeEqual(signature, await sign(payload, env.ADMIN_SECRET))) {
    return false;
  }

  try {
    const expiry = Number((JSON.parse(payload) as { x?: unknown }).x);
    return Number.isFinite(expiry) && expiry > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function readCookie(header: string, name: string): string {
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return '';
}

/** Nothing behind the gate should be cached by the CDN or indexed. */
function withAdminHeaders(response: Response): Response {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

function loginHtml(error = '', next = ''): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Admin - Yoonchul Yi</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Newsreader:ital,wght@0,400;0,500;1,400;1,500&display=swap"
    />
    <style>
      body {
        background: #f4f4f0;
        color: #191919;
        font-family: 'IBM Plex Mono', ui-monospace, monospace;
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
      }
      form { width: 100%; max-width: 20rem; }
      h1 {
        font-family: Newsreader, Georgia, serif;
        font-size: 1.5rem;
        font-weight: 400;
        margin: 0 0 1.5rem;
      }
      input {
        width: 100%;
        box-sizing: border-box;
        padding: 0.5rem 0.75rem;
        font: inherit;
        font-size: 0.875rem;
        background: transparent;
        border: 1px solid rgba(140, 140, 140, 0.4);
        color: inherit;
      }
      input:focus { border-color: #ea580c; outline: none; }
      button {
        width: 100%;
        margin-top: 0.75rem;
        padding: 0.5rem 0.75rem;
        font: inherit;
        font-size: 0.875rem;
        background: #191919;
        color: #f4f4f0;
        border: 1px solid #191919;
        cursor: pointer;
      }
      button:hover { background: #ea580c; border-color: #ea580c; }
      p.error { color: #ea580c; font-size: 0.75rem; margin: 0.75rem 0 0; }
    </style>
  </head>
  <body>
    <form method="post" action="/api/admin/login">
      <h1>Admin</h1>
      <input type="hidden" name="next" value="${escapeHtml(next)}" />
      <input
        type="password"
        name="password"
        placeholder="Password"
        autocomplete="current-password"
        autofocus
        required
      />
      <button type="submit">Enter</button>
      ${error ? `<p class="error">${error}</p>` : ''}
    </form>
  </body>
</html>`;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
