import { WIDTH, HEIGHT, font, spacing } from './styles.js';
import {
  editorialColors as cover,
  editorialSansStack as sansStack,
  renderEditorialBackground,
  renderEditorialTextBackdrop,
} from './editorial-background.js';
import type { ArticleDetailSection } from '../types.js';

export function renderArticleContent(
  section: ArticleDetailSection,
  pageNum: number,
  totalPages: number,
  backgroundPath?: string | null,
): string {
  const headerText = section.header.trim();
  const bodyText = section.body.join(' ').trim();

  const header = fitHeader(headerText);
  const headerStartY = 610;
  const headerSvg = header.lines
    .map(
      (line, i) =>
        `<text x="${spacing.page}" y="${headerStartY + i * header.gap}"
          font-family="${sansStack}" font-size="${header.font}" font-weight="700" fill="${cover.text}" letter-spacing="-1">${escSvg(line)}</text>`,
    )
    .join('\n  ');

  const bodyStartY = headerStartY + header.lines.length * header.gap + 52;
  const body = fitBody(bodyText, HEIGHT - bodyStartY - 110);
  const bodySvg = body.lines
    .map(
      (line, i) =>
        `<text x="${spacing.page}" y="${bodyStartY + i * body.lineHeight}"
          font-family="${sansStack}" font-size="${body.font}" fill="${cover.sub}">${escSvg(line)}</text>`,
    )
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${renderEditorialBackground(backgroundPath)}
  ${renderEditorialTextBackdrop()}

  <!-- Detail header -->
  ${headerSvg}

  <!-- Detail body -->
  ${bodySvg}
</svg>`;
}

function fitHeader(text: string): { lines: string[]; font: number; gap: number } {
  const tiers: { font: number; budget: number; gap: number }[] = [
    { font: 88, budget: 7.2, gap: 100 },
    { font: 76, budget: 8.5, gap: 88 },
    { font: 66, budget: 10.2, gap: 78 },
    { font: 58, budget: 12.0, gap: 70 },
  ];

  for (const tier of tiers) {
    const lines = wrapByWidth(text, tier.budget);
    if (lines.length <= 3 || tier === tiers[tiers.length - 1]) {
      return { lines, font: tier.font, gap: tier.gap };
    }
  }

  return { lines: [text], font: 58, gap: 70 };
}

function fitBody(text: string, maxHeight: number): { lines: string[]; font: number; lineHeight: number } {
  const tiers: { font: number; budget: number; lineHeight: number }[] = [
    { font: 27, budget: 36, lineHeight: 43 },
    { font: 25, budget: 39, lineHeight: 40 },
    { font: 23, budget: 42, lineHeight: 37 },
    { font: 21, budget: 46, lineHeight: 34 },
  ];

  for (const tier of tiers) {
    const lines = wrapByWidth(text, tier.budget);
    if (lines.length * tier.lineHeight <= maxHeight || tier === tiers[tiers.length - 1]) {
      return { lines, font: tier.font, lineHeight: tier.lineHeight };
    }
  }

  return { lines: wrapByWidth(text, 46), font: font.body, lineHeight: 34 };
}

function charWeight(ch: string): number {
  if (/[぀-ヿ㐀-䶿一-鿿가-힯＀-￯]/.test(ch)) {
    return 1.0;
  }
  if (ch === ' ' || /[.,!?;:'"()\[\]{}·—–-]/.test(ch)) {
    return 0.4;
  }
  return 0.62;
}

function wrapByWidth(text: string, budget: number): string[] {
  const lines: string[] = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    let width = 0;
    let cutAt = -1;
    for (let i = 0; i < remaining.length; i++) {
      const w = charWeight(remaining[i]);
      if (width + w > budget) {
        cutAt = i;
        break;
      }
      width += w;
    }

    if (cutAt === -1) {
      lines.push(remaining);
      break;
    }

    const commaIdx = remaining.lastIndexOf(', ', cutAt);
    const spaceIdx = remaining.lastIndexOf(' ', cutAt);
    const commaBreak = commaIdx > 0 ? commaIdx + 2 : -1;
    const spaceBreak = spaceIdx > 0 ? spaceIdx + 1 : -1;
    let breakAt = Math.max(commaBreak, spaceBreak);
    if (breakAt <= 0) breakAt = cutAt;

    lines.push(remaining.slice(0, breakAt).trimEnd());
    remaining = remaining.slice(breakAt).trimStart();
  }
  return lines;
}

function escSvg(s: string): string {
  return stripEmoji(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripEmoji(s: string): string {
  return s.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '');
}
