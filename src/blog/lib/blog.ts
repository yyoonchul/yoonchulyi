import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';

const WHITESPACE_PATTERN = /\s+/g;

export function getBlogSlugFromTitle(title: string): string {
  return title.trim().replace(WHITESPACE_PATTERN, '-');
}

export function getBlogHrefFromTitle(title: string): string {
  const slug = getBlogSlugFromTitle(title);
  return `/blog/${encodeURIComponent(slug)}/`;
}

export function formatBlogDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export interface BlogPostPageProps {
  post: CollectionEntry<'blog'>;
  slug: string;
  title: string;
}

export async function getBlogPostStaticPaths() {
  const posts = await getCollection('blog');

  return posts.map((post) => {
    const title = post.data.title;
    const slug = getBlogSlugFromTitle(title);

    return {
      params: { slug },
      props: { post, slug, title } satisfies BlogPostPageProps,
    };
  });
}
