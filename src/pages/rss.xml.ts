import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import {
  getBlogDescription,
  getBlogHref,
  getBlogPublishedDate,
  isBlogIndexable,
} from '../blog/lib/blog';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog'))
    .filter(isBlogIndexable)
    .sort(
      (a, b) =>
        getBlogPublishedDate(b).valueOf() - getBlogPublishedDate(a).valueOf(),
    );

  return rss({
    title: 'Yoonchul Yi',
    description:
      'Long-form essays by Yoonchul Yi on AI-native productivity, local-first notes, Claude Code workflows, startups, and personal operating systems.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: getBlogDescription(post),
      pubDate: getBlogPublishedDate(post),
      link: getBlogHref(post),
    })),
  });
}
