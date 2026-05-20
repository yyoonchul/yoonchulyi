export const SITE_URL = 'https://yoonchulyi.com';
export const SITE_NAME = 'Yoonchul Yi';
export const PERSON_ID = `${SITE_URL}/#person`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const DEFAULT_DESCRIPTION =
  'Yoonchul Yi is an AI product builder writing about local-first productivity, AI-native notes, Claude Code workflows, startups, and daily AI/devtools insights.';

export const AUTHOR = {
  name: 'Yoonchul Yi',
  alternateNames: ['이윤철', 'yoonchulyi', 'yiyoonchul', 'YC'],
  email: 'mailto:yoonchulyi@gmail.com',
  github: 'https://github.com/yyoonchul',
  linkedin: 'https://www.linkedin.com/in/ycyi/',
  x: 'https://x.com/yiyoonchul',
  threads: 'https://www.threads.com/@yiyoonchul.note',
  instagram: 'https://www.instagram.com/yiyoonchul.note/',
};

export function getAbsoluteUrl(path = '/'): string {
  return new URL(path, SITE_URL).toString();
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => {
      const labelMatch = /^\[([^\]]+)\]/.exec(match);
      return labelMatch?.[1] ?? ' ';
    })
    .replace(/[#>*_\-~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getExcerptFromMarkdown(
  markdown: string,
  fallback = DEFAULT_DESCRIPTION,
  maxLength = 155,
): string {
  const text = stripMarkdown(markdown);

  if (!text) {
    return fallback;
  }

  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength + 1);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  return `${truncated.slice(0, lastSpaceIndex > 80 ? lastSpaceIndex : maxLength).trim()}...`;
}

export function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}
