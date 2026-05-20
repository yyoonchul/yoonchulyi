import {
  AUTHOR,
  DEFAULT_DESCRIPTION,
  PERSON_ID,
  SITE_NAME,
  SITE_URL,
  WEBSITE_ID,
  getAbsoluteUrl,
} from './seo';

type JsonLd = Record<string, unknown>;

export function createPersonSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: AUTHOR.name,
    alternateName: AUTHOR.alternateNames,
    url: SITE_URL,
    email: AUTHOR.email,
    jobTitle: 'AI Product Builder',
    homeLocation: {
      '@type': 'Place',
      name: 'Seoul, South Korea',
    },
    knowsAbout: [
      'AI-native productivity',
      'Local-first software',
      'Markdown notes',
      'Claude Code workflows',
      'AI agents',
      'DevTools',
      'Startups',
      'Robotics',
    ],
    sameAs: [
      AUTHOR.linkedin,
      AUTHOR.github,
      AUTHOR.x,
      AUTHOR.threads,
      AUTHOR.instagram,
    ],
  };
}

export function createWebsiteSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    publisher: {
      '@id': PERSON_ID,
    },
  };
}

export function createProfilePageSchema(path = '/about/'): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${getAbsoluteUrl(path)}#profile`,
    url: getAbsoluteUrl(path),
    name: `About ${AUTHOR.name}`,
    mainEntity: {
      '@id': PERSON_ID,
    },
  };
}

export function createBreadcrumbSchema(
  items: Array<{ name: string; path: string }>,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: getAbsoluteUrl(item.path),
    })),
  };
}

export function createItemListSchema(
  name: string,
  path: string,
  items: Array<{ name: string; path: string; description?: string }>,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url: getAbsoluteUrl(path),
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: getAbsoluteUrl(item.path),
      name: item.name,
      description: item.description,
    })),
  };
}

export function createBlogPostingSchema({
  path,
  headline,
  description,
  datePublished,
  dateModified,
  keywords,
}: {
  path: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  keywords?: string[];
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${getAbsoluteUrl(path)}#article`,
    headline,
    description,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: {
      '@id': PERSON_ID,
    },
    publisher: {
      '@id': PERSON_ID,
    },
    mainEntityOfPage: getAbsoluteUrl(path),
    url: getAbsoluteUrl(path),
    keywords,
    isPartOf: {
      '@id': WEBSITE_ID,
    },
  };
}
