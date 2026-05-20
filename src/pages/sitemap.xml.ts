import { getCollection } from 'astro:content';
import {
  formatDateForSchema,
  getBlogHref,
  getBlogModifiedDate,
  isBlogIndexable,
} from '../blog/lib/blog';
import { getDailyInsightEntriesSorted } from '../daily-insights/lib/dailyInsights';
import { getAbsoluteUrl } from '../lib/seo';

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

function renderUrl(entry: SitemapEntry): string {
  return [
    '  <url>',
    `    <loc>${getAbsoluteUrl(entry.path)}</loc>`,
    entry.lastmod ? `    <lastmod>${entry.lastmod}</lastmod>` : '',
    entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : '',
    entry.priority ? `    <priority>${entry.priority}</priority>` : '',
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function GET() {
  const blogPosts = await getCollection('blog');
  const dailyInsights = await getDailyInsightEntriesSorted();

  const entries: SitemapEntry[] = [
    { path: '/', changefreq: 'weekly', priority: '1.0' },
    { path: '/about/', changefreq: 'monthly', priority: '0.8' },
    { path: '/blog/', changefreq: 'weekly', priority: '0.9' },
    { path: '/daily-insights/', changefreq: 'daily', priority: '0.8' },
    ...blogPosts
      .filter(isBlogIndexable)
      .map((post) => ({
        path: getBlogHref(post),
        lastmod: formatDateForSchema(getBlogModifiedDate(post)),
        changefreq: 'monthly',
        priority: post.data.featured ? '0.9' : '0.7',
      })),
    ...dailyInsights.map(({ meta }) => ({
      path: meta.href,
      lastmod: meta.isoDate,
      changefreq: 'monthly',
      priority: '0.5',
    })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(renderUrl),
    '</urlset>',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
