import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { parseDigest } from './parser.js';
import { resolveImage, type ResolvedImage } from './image-resolver.js';
import { renderArticleCover } from './templates/article-cover.js';
import { renderArticleContent } from './templates/article-content.js';
import type { ArticleData } from './types.js';

type ArticleQuery = string | { cover?: string; sections?: string[]; pages?: string[] };
type ArticleHeadline = string | { cover?: string; source?: string; sections?: string[] };

interface ImageQueries {
  articles?: ArticleQuery[];
}

interface ArticleHeadlines {
  articles?: ArticleHeadline[];
}

function loadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function loadQueries(datePath: string): ImageQueries {
  return (
    loadJson<ImageQueries>(
      resolve(import.meta.dirname, 'queries', `${datePath}.json`),
    ) ?? {}
  );
}

function loadArticleHeadlines(datePath: string): ArticleHeadlines {
  return (
    loadJson<ArticleHeadlines>(
      resolve(import.meta.dirname, 'article-headers', `${datePath}.json`),
    ) ?? {}
  );
}

function todayKST(): string {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
  );
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

async function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(1080, 1350)
    .png()
    .toBuffer();
}

function articleHeadline(article: ArticleData, headlines: ArticleHeadlines): string {
  const value = headlines.articles?.[article.index - 1];
  if (typeof value === 'string') return value;
  if (value?.cover) return value.cover;
  return article.title;
}

function articleSourceLine(article: ArticleData, headlines: ArticleHeadlines): string {
  const value = headlines.articles?.[article.index - 1];
  if (typeof value === 'object' && value.source) return value.source;
  return article.title;
}

function articleSectionHeadline(
  article: ArticleData,
  headlines: ArticleHeadlines,
  sectionIndex: number,
): string {
  const value = headlines.articles?.[article.index - 1];
  if (typeof value === 'object' && value.sections?.[sectionIndex]) {
    return value.sections[sectionIndex];
  }
  return article.detailSections?.[sectionIndex]?.header ?? article.title;
}

function articleCoverQuery(article: ArticleData, queries: ImageQueries): string {
  const value = queries.articles?.[article.index - 1];
  if (typeof value === 'string') return value;
  return value?.cover ?? article.category ?? article.title;
}

function articleSectionQuery(
  article: ArticleData,
  queries: ImageQueries,
  sectionIndex: number,
): string {
  const value = queries.articles?.[article.index - 1];
  if (typeof value === 'string') return value;
  return (
    value?.sections?.[sectionIndex] ??
    value?.pages?.[sectionIndex] ??
    value?.cover ??
    article.category ??
    article.title
  );
}

async function renderArticleDeck(
  datePath: string,
  article: ArticleData,
  headline: string,
  headlines: ArticleHeadlines,
  queries: ImageQueries,
): Promise<void> {
  const detailSections = article.detailSections ?? [];
  if (detailSections.length === 0) {
    throw new Error(`No detailed notes found for article ${article.index}: ${article.title}`);
  }

  const usedSourceUrls = new Set<string>();
  const coverQuery = articleCoverQuery(article, queries);
  const coverImage = await resolveImage(coverQuery, { avoidSourceUrls: usedSourceUrls });
  if (coverImage) usedSourceUrls.add(coverImage.sourceUrl);
  const coverBg = coverImage?.filePath;
  const totalPages = 1 + detailSections.length;
  const outDir = resolve(
    import.meta.dirname,
    'output',
    datePath,
  );
  mkdirSync(outDir, { recursive: true });

  const slides: { svg: string; credit: ResolvedImage | null; query: string }[] = [
    {
      svg: renderArticleCover(article, headline, articleSourceLine(article, headlines), coverBg),
      credit: coverImage,
      query: coverQuery,
    },
  ];

  for (let i = 0; i < detailSections.length; i++) {
    const section = {
      ...detailSections[i],
      header: articleSectionHeadline(article, headlines, i),
    };
    const sectionQuery = articleSectionQuery(article, queries, i);
    const sectionImage = await resolveImage(sectionQuery, { avoidSourceUrls: usedSourceUrls });
    if (sectionImage) usedSourceUrls.add(sectionImage.sourceUrl);
    slides.push({
      svg: renderArticleContent(section, i + 2, totalPages, sectionImage?.filePath),
      credit: sectionImage,
      query: sectionQuery,
    });
  }

  for (let i = 0; i < slides.length; i++) {
    const num = `${article.index}-${i + 1}`;
    const png = await svgToPng(slides[i].svg);
    writeFileSync(join(outDir, `${num}.png`), png);
  }

  const credits = slides.map((s, i) =>
    s.credit
      ? { slide: `${article.index}-${i + 1}`, status: 'ok' as const, query: s.query, ...s.credit }
      : { slide: `${article.index}-${i + 1}`, status: 'missing' as const, query: s.query },
  );
  writeFileSync(
    join(outDir, `article-${String(article.index).padStart(2, '0')}-credits.json`),
    JSON.stringify(credits, null, 2),
  );
  console.log(`Generated ${slides.length} article slides -> ${outDir}`);
}

async function main() {
  const datePath = process.argv[2] || todayKST();
  const requestedArticle = process.argv[3] ? Number(process.argv[3]) : null;

  if (requestedArticle !== null && !Number.isInteger(requestedArticle)) {
    throw new Error('Article index must be an integer');
  }

  const digest = parseDigest(datePath);
  const queries = loadQueries(datePath);
  const headlines = loadArticleHeadlines(datePath);
  const articles = requestedArticle
    ? digest.articles.filter((article) => article.index === requestedArticle)
    : digest.articles;

  if (articles.length === 0) {
    throw new Error(`No article found for index ${requestedArticle}`);
  }

  for (const article of articles) {
    await renderArticleDeck(
      datePath,
      article,
      articleHeadline(article, headlines),
      headlines,
      queries,
    );
  }
}

main();
