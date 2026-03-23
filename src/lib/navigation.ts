const INDEX_HTML_SUFFIX = '/index.html';

export function normalizePathname(pathname: string): string {
  if (!pathname) {
    return '/';
  }

  if (pathname === INDEX_HTML_SUFFIX) {
    return '/';
  }

  if (pathname.endsWith(INDEX_HTML_SUFFIX)) {
    return `${pathname.slice(0, -INDEX_HTML_SUFFIX.length)}/`;
  }

  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

export function isPathActive(
  pathname: string,
  href: string,
  options?: { exact?: boolean },
): boolean {
  const current = normalizePathname(pathname);
  const target = normalizePathname(href);

  if (options?.exact) {
    return current === target;
  }

  return current === target || current.startsWith(target);
}
