import type { APIRoute } from 'astro';
import {
  getSharedHtmlEntries,
  readSharedHtml,
} from '../../standalone-pages/lib/sharedHtml';

export const prerender = true;

export async function getStaticPaths() {
  const entries = await getSharedHtmlEntries();

  return entries.map((entry) => ({
    params: {
      slug: entry.slug,
    },
  }));
}

function addNoIndexMeta(html: string): string {
  if (/<meta\s+name=["']robots["']/i.test(html)) {
    return html;
  }

  return html.replace(
    /<\/head>/i,
    '<meta name="robots" content="noindex,nofollow">\n</head>',
  );
}

export const GET: APIRoute = async ({ params }) => {
  if (!params.slug) {
    return new Response('Not found', { status: 404 });
  }

  const html = await readSharedHtml(params.slug);

  if (!html) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(addNoIndexMeta(html), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
};
