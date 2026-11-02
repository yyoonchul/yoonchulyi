/**
 * One-off: fold the old `essays` and `daily` topics into one newsletter topic.
 *
 * Every contact opted in to either old topic is opted in to the new one. The
 * old topics are left untouched, so nothing a reader chose is erased and the
 * run can be repeated safely — contacts already on the new topic are skipped.
 *
 * Usage:
 *   RESEND_API_KEY=re_… npx tsx scripts/newsletter/migrate-topic.ts           report only
 *   RESEND_API_KEY=re_… npx tsx scripts/newsletter/migrate-topic.ts --apply   create topic + opt in
 *
 * Pass RESEND_TOPIC_NEWSLETTER to reuse a topic created earlier instead of
 * creating another one.
 */

const API = 'https://api.resend.com';
const OLD_TOPICS = {
  essays: process.env.RESEND_TOPIC_ESSAYS ?? '82d8b4be-5f0e-4695-b513-c773a7c474a9',
  daily: process.env.RESEND_TOPIC_DAILY ?? '52cde607-0aef-4096-b665-0b45519f0c96',
};
const NEW_TOPIC_NAME = 'Newsletter';
const NEW_TOPIC_DESCRIPTION = 'Essays and the weekly Daily Insights letter.';
// The account is capped at 10 requests/second.
const PAUSE_MS = 150;

interface Contact {
  id: string;
  email: string;
  unsubscribed?: boolean;
}

interface ContactTopic {
  id: string;
  subscription?: string;
}

const apiKey = process.env.RESEND_API_KEY ?? '';
if (!apiKey.startsWith('re_')) {
  console.error('RESEND_API_KEY must be a real Resend key (re_…).');
  process.exit(1);
}
const apply = process.argv.includes('--apply');

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status}: ${raw}`);
  }
  return (raw ? JSON.parse(raw) : {}) as T;
}

async function listContacts(): Promise<Contact[]> {
  const contacts: Contact[] = [];
  let after = '';
  for (;;) {
    const page = await call<{ data?: Contact[]; has_more?: boolean }>(
      'GET',
      `/contacts?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`,
    );
    const batch = page.data ?? [];
    contacts.push(...batch);
    if (!page.has_more || batch.length === 0) {
      return contacts;
    }
    after = batch[batch.length - 1].id;
  }
}

async function optedIn(contactId: string): Promise<Set<string>> {
  const body = await call<{ data?: ContactTopic[] }>('GET', `/contacts/${contactId}/topics`);
  return new Set(
    (body.data ?? []).filter((topic) => topic.subscription === 'opt_in').map((topic) => topic.id),
  );
}

async function main() {
  let newTopic = process.env.RESEND_TOPIC_NEWSLETTER ?? '';

  const contacts = (await listContacts()).filter((contact) => !contact.unsubscribed);
  console.log(`${contacts.length} active contacts`);

  const toMove: Contact[] = [];
  for (const contact of contacts) {
    const topics = await optedIn(contact.id);
    const old = Object.entries(OLD_TOPICS)
      .filter(([, id]) => topics.has(id))
      .map(([name]) => name);
    const already = Boolean(newTopic) && topics.has(newTopic);
    console.log(
      `  ${contact.email}  old: ${old.join(' + ') || '—'}${already ? '  (already on new topic)' : ''}`,
    );
    if (old.length > 0 && !already) {
      toMove.push(contact);
    }
  }

  console.log(`${toMove.length} to opt in to the new topic`);
  if (!apply) {
    console.log('report only — pass --apply to create the topic and opt them in');
    return;
  }

  if (!newTopic) {
    const created = await call<{ id: string }>('POST', '/topics', {
      name: NEW_TOPIC_NAME,
      description: NEW_TOPIC_DESCRIPTION,
      default_subscription: 'opt_out',
    });
    newTopic = created.id;
    console.log(`created topic "${NEW_TOPIC_NAME}": ${newTopic}`);
  }

  let failed = 0;
  for (const contact of toMove) {
    await call('PATCH', `/contacts/${contact.id}/topics`, [
      { id: newTopic, subscription: 'opt_in' },
    ]);
    // Read back rather than trust the 200: the write is what the send depends on.
    const ok = (await optedIn(contact.id)).has(newTopic);
    if (!ok) {
      failed += 1;
    }
    console.log(`  ${ok ? 'moved ' : 'FAILED'} ${contact.email}`);
  }

  console.log(`\nRESEND_TOPIC_NEWSLETTER=${newTopic}`);
  console.log(`${toMove.length - failed} moved, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
