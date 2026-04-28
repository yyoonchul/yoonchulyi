import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface ResolvedImage {
  filePath: string;
  source: 'unsplash' | 'pexels' | 'wikimedia';
  author: string;
  authorUrl?: string;
  sourceUrl: string;
  license: string;
  query: string;
}

const APP_NAME = 'daily-insights';
const CACHE_DIR = resolve(import.meta.dirname, 'assets', 'cache');
const UA = `${APP_NAME}/1.0 (https://yoonchulyi.com)`;

const memoryCache = new Map<string, ResolvedImage | null>();

export async function resolveImage(rawQuery: string): Promise<ResolvedImage | null> {
  const query = rawQuery.trim();
  if (!query) return null;
  if (memoryCache.has(query)) return memoryCache.get(query)!;

  logResolver(
    `query="${query}" env unsplash=${Boolean(process.env.UNSPLASH_ACCESS_KEY)} pexels=${Boolean(process.env.PEXELS_API_KEY)}`,
  );

  const result =
    (await safe('unsplash', () => tryUnsplash(query))) ??
    (await safe('pexels', () => tryPexels(query))) ??
    (await safe('wikimedia', () => tryWikimedia(query)));

  if (!result) {
    logResolver(`query="${query}" unresolved by all providers`);
  }

  memoryCache.set(query, result);
  return result;
}

async function tryUnsplash(query: string): Promise<ResolvedImage | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    logResolver(`unsplash skipped for "${query}" (missing UNSPLASH_ACCESS_KEY)`);
    return null;
  }

  const searchUrl =
    `https://api.unsplash.com/search/photos` +
    `?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait&content_filter=high`;
  const res = await fetch(searchUrl, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
  });
  if (!res.ok) {
    logResolver(`unsplash failed for "${query}" (HTTP ${res.status})`);
    return null;
  }
  const data = (await res.json()) as UnsplashSearchResponse;
  const photo = data.results?.[0];
  if (!photo) {
    logResolver(`unsplash returned no usable result for "${query}"`);
    return null;
  }

  const filePath = await downloadToCache(photo.urls.regular, `unsplash-${photo.id}`, 'jpg');

  // Unsplash API 가이드라인: 사용 시점에 download_location 핑 필수
  fetch(`${photo.links.download_location}?client_id=${key}`).catch(() => {});

  const utm = `?utm_source=${APP_NAME}&utm_medium=referral`;
  logResolver(`unsplash resolved "${query}"`);
  return {
    filePath,
    source: 'unsplash',
    author: photo.user.name,
    authorUrl: `${photo.user.links.html}${utm}`,
    sourceUrl: `${photo.links.html}${utm}`,
    license: 'Unsplash License',
    query,
  };
}

async function tryPexels(query: string): Promise<ResolvedImage | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    logResolver(`pexels skipped for "${query}" (missing PEXELS_API_KEY)`);
    return null;
  }

  const searchUrl =
    `https://api.pexels.com/v1/search` +
    `?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`;
  const res = await fetch(searchUrl, { headers: { Authorization: key } });
  if (!res.ok) {
    logResolver(`pexels failed for "${query}" (HTTP ${res.status})`);
    return null;
  }
  const data = (await res.json()) as PexelsSearchResponse;
  const photo = data.photos?.[0];
  if (!photo) {
    logResolver(`pexels returned no usable result for "${query}"`);
    return null;
  }

  const filePath = await downloadToCache(photo.src.large2x, `pexels-${photo.id}`, 'jpg');

  logResolver(`pexels resolved "${query}"`);
  return {
    filePath,
    source: 'pexels',
    author: photo.photographer,
    authorUrl: photo.photographer_url,
    sourceUrl: photo.url,
    license: 'Pexels License',
    query,
  };
}

const ALLOWED_WIKIMEDIA_LICENSE = /^(CC0|Public domain|CC BY( \d+(\.\d+)?)?)$/i;

async function tryWikimedia(query: string): Promise<ResolvedImage | null> {
  const searchUrl =
    `https://commons.wikimedia.org/w/api.php` +
    `?action=query&format=json&list=search&srnamespace=6&srlimit=8` +
    `&srsearch=${encodeURIComponent(`${query} filemime:image/jpeg|image/png`)}` +
    `&origin=*`;
  const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
  if (!searchRes.ok) {
    logResolver(`wikimedia search failed for "${query}" (HTTP ${searchRes.status})`);
    return null;
  }
  const searchData = (await searchRes.json()) as WikimediaSearchResponse;
  const candidates = searchData.query?.search ?? [];
  if (candidates.length === 0) {
    logResolver(`wikimedia returned no candidates for "${query}"`);
    return null;
  }

  for (const c of candidates) {
    const infoUrl =
      `https://commons.wikimedia.org/w/api.php` +
      `?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata` +
      `&titles=${encodeURIComponent(c.title)}&origin=*`;
    const infoRes = await fetch(infoUrl, { headers: { 'User-Agent': UA } });
    if (!infoRes.ok) {
      logResolver(`wikimedia info failed for "${query}" (${c.title}, HTTP ${infoRes.status})`);
      continue;
    }
    const infoData = (await infoRes.json()) as WikimediaInfoResponse;
    const page = Object.values(infoData.query?.pages ?? {})[0];
    const info = page?.imageinfo?.[0];
    if (!info) continue;

    const meta = info.extmetadata ?? {};
    const license = meta.LicenseShortName?.value?.trim() ?? '';
    if (!ALLOWED_WIKIMEDIA_LICENSE.test(license)) continue; // CC BY-SA / GFDL 등 share-alike 제외

    const ext = (info.url.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'jpg').toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) continue;

    const idHash = createHash('sha1').update(c.title).digest('hex').slice(0, 12);
    const filePath = await downloadToCache(info.url, `wikimedia-${idHash}`, ext);

    logResolver(`wikimedia resolved "${query}"`);
    return {
      filePath,
      source: 'wikimedia',
      author: stripHtml(meta.Artist?.value ?? 'Unknown'),
      sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(c.title)}`,
      license,
      query,
    };
  }
  return null;
}

async function downloadToCache(url: string, baseName: string, ext: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const safe = baseName.replace(/[^a-z0-9-]/gi, '_');
  const filePath = join(CACHE_DIR, `${safe}.${ext}`);
  if (existsSync(filePath)) return filePath;

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
  return filePath;
}

async function safe<T>(provider: string, fn: () => Promise<T | null>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[image-resolver] ${provider}: ${(err as Error).message}`);
    return null;
  }
}

function logResolver(message: string) {
  console.log(`[image-resolver] ${message}`);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

interface UnsplashSearchResponse {
  results?: {
    id: string;
    urls: { regular: string };
    links: { html: string; download_location: string };
    user: { name: string; links: { html: string } };
  }[];
}

interface PexelsSearchResponse {
  photos?: {
    id: number;
    url: string;
    photographer: string;
    photographer_url: string;
    src: { large2x: string };
  }[];
}

interface WikimediaSearchResponse {
  query?: { search?: { title: string }[] };
}

interface WikimediaInfoResponse {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: {
          url: string;
          extmetadata?: {
            LicenseShortName?: { value: string };
            Artist?: { value: string };
          };
        }[];
      }
    >;
  };
}
