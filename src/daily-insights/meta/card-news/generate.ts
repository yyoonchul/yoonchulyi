import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { parseDigest } from './parser.js';
import { resolveImage, type ResolvedImage } from './image-resolver.js';
import { renderCover } from './templates/cover.js';
import { renderContent } from './templates/content.js';

interface ImageQueries {
  cover?: string;
  articles?: string[];
}

interface Headers {
  // 커버 메인 제목. 스킬은 하나의 제목을 cover[0]에 담는다.
  cover?: string[];
  // 기사별 불렛 헤더 — articles[i][j] = 기사 i의 j번째 불렛 페이지 헤더.
  articles?: string[][];
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

function loadHeaders(datePath: string): Headers {
  return (
    loadJson<Headers>(
      resolve(import.meta.dirname, 'headers', `${datePath}.json`),
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

async function main() {
  const datePath = process.argv[2] || todayKST();
  console.log(`Generating card news for: ${datePath}`);

  const digest = parseDigest(datePath);
  const headers = loadHeaders(datePath);
  const queries = loadQueries(datePath);

  // 헤더 사이드카 적용:
  // - cover: 메인 제목 → cover.headlineLines
  // - articles[i][j]: 기사 i의 j번째 불렛에 대응하는 페이지 헤더
  if (headers.cover && headers.cover.length > 0) {
    digest.cover.headlineLines = headers.cover;
  }
  if (headers.articles) {
    digest.articles.forEach((a, i) => {
      const arr = headers.articles?.[i];
      if (arr && arr.length > 0) a.bulletHeaders = arr;
    });
  }

  // 슬라이드: 커버 1장 + 기사별 불렛 1개당 1장(content).
  const totalPages =
    1 + digest.articles.reduce((sum, a) => sum + a.bullets.length, 0);

  const outDir = resolve(import.meta.dirname, 'output', datePath);
  mkdirSync(outDir, { recursive: true });

  const slides: { svg: string; credit: ResolvedImage | null; query: string }[] = [];

  // Cover
  const coverQuery = queries.cover ?? digest.cover.categories[0] ?? 'technology';
  const coverImage = await resolveImage(coverQuery);
  const coverSvg = renderCover(digest.cover, coverImage?.filePath)
    .replace('{{totalPages}}', String(totalPages));
  slides.push({ svg: coverSvg, credit: coverImage, query: coverQuery });

  // Content: 기사별 불렛 1개당 1장. 같은 기사 안에서는 배경 이미지를 공유한다.
  let pageCursor = 2;
  for (let i = 0; i < digest.articles.length; i++) {
    const article = digest.articles[i];

    const articleQuery = queries.articles?.[i] ?? article.category ?? article.title;
    const articleImage = await resolveImage(articleQuery);
    const bg = articleImage?.filePath;

    for (let j = 0; j < article.bullets.length; j++) {
      const bullet = article.bullets[j];
      const header = article.bulletHeaders?.[j] ?? article.title;
      slides.push({
        svg: renderContent(article, header, bullet, pageCursor, totalPages, bg),
        credit: articleImage,
        query: articleQuery,
      });
      pageCursor++;
    }
  }

  // Write PNGs — 순번이 곧 업로드 순서
  for (let i = 0; i < slides.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    const png = await svgToPng(slides[i].svg);
    writeFileSync(join(outDir, `${num}.png`), png);
  }

  // 이미지 크레딧 메타 — 모든 슬라이드 기록 (해석 실패도 null로 남김)
  const credits = slides.map((s, i) =>
    s.credit
      ? { slide: i + 1, status: 'ok' as const, query: s.query, ...s.credit }
      : { slide: i + 1, status: 'missing' as const, query: s.query },
  );
  writeFileSync(join(outDir, 'credits.json'), JSON.stringify(credits, null, 2));

  const missing = credits.filter((c) => c.status === 'missing').map((c) => c.slide);
  console.log(`Generated ${slides.length} slides → ${outDir}`);
  if (missing.length > 0) {
    console.log(`⚠️  Image unresolved for slides: ${missing.join(', ')}`);
  }
}

main();
