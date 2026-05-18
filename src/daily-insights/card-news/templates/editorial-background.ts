import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { HEIGHT, WIDTH } from './styles.js';

export const editorialColors = {
  bgTop: '#1B1B1D',
  bgBottom: '#050506',
  text: '#FFFFFF',
  sub: '#A8A8AD',
  accent: '#F26B1F',
  subtle: '#2A2A2D',
};

export const editorialSansStack =
  "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Inter', system-ui, sans-serif";

const TEXT_BACKDROP_Y = 610;

const BACKGROUND_CANDIDATES = [
  'background.png',
  'background.jpg',
  'background.jpeg',
  'background.webp',
  'background.svg',
] as const;

let cachedBackgroundHref: string | null | undefined;

export function renderEditorialBackground(overridePath?: string | null): string {
  const backgroundImageHref = overridePath
    ? fileToDataUri(overridePath)
    : getBackgroundImageHref();

  return `<defs>
    <linearGradient id="editorialBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${editorialColors.bgTop}"/>
      <stop offset="55%" stop-color="#121214"/>
      <stop offset="100%" stop-color="${editorialColors.bgBottom}"/>
    </linearGradient>
    <radialGradient id="editorialBacklight" cx="50%" cy="32%" r="48%">
      <stop offset="0%" stop-color="#6A6A70" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="#2A2A2E" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="editorialFigure" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#050506" stop-opacity="0.95"/>
      <stop offset="70%" stop-color="#050506" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#050506" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="editorialTextBackdrop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="38%" stop-color="#000" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.96"/>
    </linearGradient>
    <filter id="editorialGrain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.1 0"/>
    </filter>
    <filter id="editorialBlur" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>

  ${backgroundImageHref
    ? `<image href="${backgroundImageHref}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#000000" opacity="0.42"/>`
    : `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#editorialBg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#editorialBacklight)"/>
  <g filter="url(#editorialBlur)" opacity="0.9">
    <ellipse cx="${WIDTH / 2 + 30}" cy="430" rx="180" ry="230" fill="url(#editorialFigure)"/>
  </g>`}

  <rect width="${WIDTH}" height="${HEIGHT}" filter="url(#editorialGrain)" opacity="0.8"/>`;
}

export function renderEditorialTextBackdrop(): string {
  return `<rect x="0" y="${TEXT_BACKDROP_Y}" width="${WIDTH}" height="${HEIGHT - TEXT_BACKDROP_Y}" fill="url(#editorialTextBackdrop)"/>`;
}

function getBackgroundImageHref(): string | null {
  if (cachedBackgroundHref !== undefined) {
    return cachedBackgroundHref;
  }

  for (const filename of BACKGROUND_CANDIDATES) {
    const fullPath = resolve(import.meta.dirname, '..', 'assets', filename);
    if (!existsSync(fullPath)) {
      continue;
    }

    cachedBackgroundHref = fileToDataUri(fullPath);
    return cachedBackgroundHref;
  }

  cachedBackgroundHref = null;
  return cachedBackgroundHref;
}

function fileToDataUri(path: string): string {
  const extension = extname(path).toLowerCase();

  if (extension === '.svg') {
    const svg = readFileSync(path, 'utf8');
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const mimeType = mimeTypeForExtension(extension);
  const base64 = readFileSync(path).toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

function mimeTypeForExtension(extension: string): string {
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
