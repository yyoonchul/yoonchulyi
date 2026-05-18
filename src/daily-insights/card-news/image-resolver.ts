import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface ResolvedImage {
  filePath: string;
  source: 'openverse' | 'nasa' | 'unsplash' | 'pexels' | 'wikimedia';
  author: string;
  authorUrl?: string;
  sourceUrl: string;
  license: string;
  query: string;
}

export interface ResolveImageOptions {
  avoidSourceUrls?: Set<string>;
}

const APP_NAME = 'daily-insights';
const CACHE_DIR = resolve(import.meta.dirname, 'assets', 'cache');
const UA = `${APP_NAME}/1.0 (https://yoonchulyi.com)`;
const TARGET_RATIO = 1080 / 1350;

const memoryCache = new Map<string, ResolvedImage | null>();

export async function resolveImage(
  rawQuery: string,
  options: ResolveImageOptions = {},
): Promise<ResolvedImage | null> {
  const query = rawQuery.trim();
  if (!query) return null;
  const hasAvoidList = Boolean(options.avoidSourceUrls?.size);
  if (!hasAvoidList && memoryCache.has(query)) return memoryCache.get(query)!;

  logResolver(
    `query="${query}" env unsplash=${Boolean(process.env.UNSPLASH_ACCESS_KEY)} pexels=${Boolean(process.env.PEXELS_API_KEY)}`,
  );

  const result =
    (await safe('wikimedia', () => tryWikimedia(query, options))) ??
    (await safe('openverse', () => tryOpenverse(query, options))) ??
    (await safe('nasa', () => tryNasa(query, options))) ??
    (await safe('unsplash', () => tryUnsplash(query, options))) ??
    (await safe('pexels', () => tryPexels(query, options)));

  if (!result) {
    logResolver(`query="${query}" unresolved by all providers`);
  }

  if (!hasAvoidList) memoryCache.set(query, result);
  return result;
}

const ALLOWED_OPENVERSE_LICENSE = /^(cc0|pdm|by)$/i;

async function tryOpenverse(
  query: string,
  options: ResolveImageOptions,
): Promise<ResolvedImage | null> {
  const searchUrl =
    `https://api.openverse.org/v1/images/` +
    `?q=${encodeURIComponent(query)}` +
    `&page_size=20&license_type=commercial&extension=jpg,png,webp`;
  const res = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    logResolver(`openverse failed for "${query}" (HTTP ${res.status})`);
    return null;
  }

  const data = (await res.json()) as OpenverseSearchResponse;
  const candidates = (data.results ?? [])
    .map((image, index) => {
      const picked = pickDownloadableImage([image.url, image.thumbnail]);
      if (!picked) return null;
      const sourceUrl = image.foreign_landing_url || picked.url;
      return { image, picked, sourceUrl, score: candidateScore(index, image.width, image.height) };
    })
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .sort((a, b) => a.score - b.score);

  for (const { image, picked, sourceUrl } of candidates) {
    const license = image.license?.toLowerCase() ?? '';
    if (!ALLOWED_OPENVERSE_LICENSE.test(license)) continue;
    if (isAvoided(sourceUrl, options)) continue;

    const idHash = createHash('sha1').update(image.id || picked.url).digest('hex').slice(0, 12);
    const filePath = await downloadToCache(picked.url, `openverse-${idHash}`, picked.ext);

    logResolver(`openverse resolved "${query}"`);
    return {
      filePath,
      source: 'openverse',
      author: image.creator?.trim() || image.provider || 'Unknown',
      authorUrl: image.creator_url || undefined,
      sourceUrl,
      license: formatOpenverseLicense(image),
      query,
    };
  }

  logResolver(`openverse returned no usable result for "${query}"`);
  return null;
}

async function tryNasa(query: string, options: ResolveImageOptions): Promise<ResolvedImage | null> {
  const searchUrl =
    `https://images-api.nasa.gov/search` +
    `?q=${encodeURIComponent(query)}&media_type=image&page_size=8`;
  const res = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    logResolver(`nasa failed for "${query}" (HTTP ${res.status})`);
    return null;
  }

  const data = (await res.json()) as NasaSearchResponse;
  for (const item of data.collection?.items ?? []) {
    const nasaId = item.data?.[0]?.nasa_id;
    const sourceUrl = nasaId
      ? `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`
      : '';
    if (sourceUrl && isAvoided(sourceUrl, options)) continue;
    const picked = pickDownloadableImage(
      item.links?.filter((l) => l.render === 'image').map((l) => l.href) ?? [],
    );
    if (!picked || !nasaId) continue;

    const filePath = await downloadToCache(picked.url, `nasa-${nasaId}`, picked.ext);

    logResolver(`nasa resolved "${query}"`);
    return {
      filePath,
      source: 'nasa',
      author: item.data?.[0]?.center || 'NASA',
      sourceUrl,
      license: 'NASA Media Usage Guidelines',
      query,
    };
  }

  logResolver(`nasa returned no usable result for "${query}"`);
  return null;
}

async function tryUnsplash(
  query: string,
  options: ResolveImageOptions,
): Promise<ResolvedImage | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    logResolver(`unsplash skipped for "${query}" (missing UNSPLASH_ACCESS_KEY)`);
    return null;
  }

  const searchUrl =
    `https://api.unsplash.com/search/photos` +
    `?query=${encodeURIComponent(query)}&per_page=20&orientation=portrait&content_filter=high`;
  const res = await fetch(searchUrl, {
    headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
  });
  if (!res.ok) {
    logResolver(`unsplash failed for "${query}" (HTTP ${res.status})`);
    return null;
  }
  const data = (await res.json()) as UnsplashSearchResponse;
  const photo = (data.results ?? [])
    .map((photo, index) => ({ photo, score: candidateScore(index, photo.width, photo.height) }))
    .filter((p) => !isAvoided(withUtm(p.photo.links.html), options))
    .sort((a, b) => a.score - b.score)[0]?.photo;
  if (!photo) {
    logResolver(`unsplash returned no usable result for "${query}"`);
    return null;
  }

  const filePath = await downloadToCache(photo.urls.regular, `unsplash-${photo.id}`, 'jpg');

  // Unsplash API 가이드라인: 사용 시점에 download_location 핑 필수
  fetch(`${photo.links.download_location}?client_id=${key}`).catch(() => {});

  logResolver(`unsplash resolved "${query}"`);
  return {
    filePath,
    source: 'unsplash',
    author: photo.user.name,
    authorUrl: withUtm(photo.user.links.html),
    sourceUrl: withUtm(photo.links.html),
    license: 'Unsplash License',
    query,
  };
}

async function tryPexels(
  query: string,
  options: ResolveImageOptions,
): Promise<ResolvedImage | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    logResolver(`pexels skipped for "${query}" (missing PEXELS_API_KEY)`);
    return null;
  }

  const searchUrl =
    `https://api.pexels.com/v1/search` +
    `?query=${encodeURIComponent(query)}&per_page=20&orientation=portrait`;
  const res = await fetch(searchUrl, { headers: { Authorization: key } });
  if (!res.ok) {
    logResolver(`pexels failed for "${query}" (HTTP ${res.status})`);
    return null;
  }
  const data = (await res.json()) as PexelsSearchResponse;
  const photo = (data.photos ?? [])
    .map((photo, index) => ({ photo, score: candidateScore(index, photo.width, photo.height) }))
    .filter((p) => !isAvoided(p.photo.url, options))
    .sort((a, b) => a.score - b.score)[0]?.photo;
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

async function tryWikimedia(
  query: string,
  options: ResolveImageOptions,
): Promise<ResolvedImage | null> {
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

  const resolvedCandidates: {
    c: { title: string };
    info: WikimediaImageInfo;
    meta: WikimediaImageInfo['extmetadata'];
    license: string;
    score: number;
  }[] = [];

  for (const [index, c] of candidates.entries()) {
    const infoUrl =
      `https://commons.wikimedia.org/w/api.php` +
      `?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata` +
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

    const sourceUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(c.title)}`;
    if (isAvoided(sourceUrl, options)) continue;

    const ext = (info.url.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'jpg').toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) continue;
    resolvedCandidates.push({
      c,
      info,
      meta,
      license,
      score: candidateScore(index, info.width, info.height),
    });
  }

  for (const { c, info, meta, license } of resolvedCandidates.sort((a, b) => a.score - b.score)) {
    const ext = (info.url.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'jpg').toLowerCase();

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

function imageExtension(url: string): 'jpg' | 'png' | 'webp' | null {
  let pathname = '';
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const ext = (pathname.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
  if (ext === 'jpeg') return 'jpg';
  if (ext === 'jpg' || ext === 'png' || ext === 'webp') return ext;
  return null;
}

function pickDownloadableImage(
  urls: (string | undefined)[],
): { url: string; ext: 'jpg' | 'png' | 'webp' } | null {
  for (const url of urls) {
    if (!url) continue;
    const ext = imageExtension(url);
    if (ext) return { url, ext };
  }
  return null;
}

function candidateScore(index: number, width?: number, height?: number): number {
  return index * 0.25 + aspectScore(width, height);
}

function aspectScore(width?: number, height?: number): number {
  if (!width || !height) return Number.MAX_SAFE_INTEGER;
  return Math.abs(width / height - TARGET_RATIO);
}

function isAvoided(sourceUrl: string, options: ResolveImageOptions): boolean {
  return Boolean(options.avoidSourceUrls?.has(sourceUrl));
}

function withUtm(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}utm_source=${APP_NAME}&utm_medium=referral`;
}

function formatOpenverseLicense(image: OpenverseImage): string {
  const license = image.license?.toUpperCase() || 'Openverse';
  const version = image.license_version ? ` ${image.license_version}` : '';
  return `${license}${version}`.trim();
}

interface OpenverseImage {
  id?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  creator?: string;
  creator_url?: string;
  provider?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  width?: number;
  height?: number;
}

interface OpenverseSearchResponse {
  results?: OpenverseImage[];
}

interface NasaSearchResponse {
  collection?: {
    items?: {
      href?: string;
      data?: {
        title?: string;
        nasa_id?: string;
        center?: string;
      }[];
      links?: {
        href?: string;
        rel?: string;
        render?: string;
      }[];
    }[];
  };
}

interface UnsplashSearchResponse {
  results?: {
    id: string;
    width?: number;
    height?: number;
    urls: { regular: string };
    links: { html: string; download_location: string };
    user: { name: string; links: { html: string } };
  }[];
}

interface PexelsSearchResponse {
  photos?: {
    id: number;
    width?: number;
    height?: number;
    url: string;
    photographer: string;
    photographer_url: string;
    src: { large2x: string };
  }[];
}

interface WikimediaSearchResponse {
  query?: { search?: { title: string }[] };
}

interface WikimediaImageInfo {
  url: string;
  width?: number;
  height?: number;
  extmetadata?: {
    LicenseShortName?: { value: string };
    Artist?: { value: string };
  };
}

interface WikimediaInfoResponse {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: WikimediaImageInfo[];
      }
    >;
  };
}
