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
