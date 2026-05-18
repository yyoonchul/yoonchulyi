import { WIDTH, HEIGHT, fontFamily, font, spacing } from './styles.js';
import {
  editorialColors as cover,
  editorialSansStack as sansStack,
  renderEditorialBackground,
} from './editorial-background.js';
import type { ArticleData } from '../types.js';

export function renderArticleCover(
  article: ArticleData,
  headline: string,
  sourceLine: string,
  backgroundPath?: string | null,
): string {
  const headlineText = headline.trim() || article.title;
  const headlineLines = fitHeadline(headlineText);
  const headlineBlockHeight = (headlineLines.lines.length - 1) * headlineLines.gap;
  const headlineCenterY = HEIGHT / 2 + 40;
  const headlineStartY = headlineCenterY - headlineBlockHeight / 2;
  const headlineBottomY = headlineStartY + headlineBlockHeight;
  const headlineSvg = headlineLines.lines
    .map((line, i) => {
      const y = headlineStartY + i * headlineLines.gap;
      return `<text x="${spacing.page}" y="${y}" font-family="${sansStack}" font-size="${headlineLines.font}" font-weight="700" fill="${cover.text}" letter-spacing="-1">${escSvg(line)}</text>`;
    })
    .join('\n  ');

  const sourceTitleLines = clampLines(wrapByWidth(sourceLine.trim() || article.title, 56), 3);
  const sourceTitleGap = Math.round(headlineLines.font * 0.42);
  const sourceTitleY = headlineBottomY + sourceTitleGap;
  const sourceTitleFont = 24;
  const sourceTitleLineHeight = 38;
  const sourceTitleSvg = sourceTitleLines
    .map(
      (line, i) =>
        `<text x="${spacing.page}" y="${sourceTitleY + i * sourceTitleLineHeight}"
        font-family="${fontFamily.mono}" font-size="${sourceTitleFont}" fill="${cover.accent}" letter-spacing="4">${escSvg(line)}</text>`,
    )
    .join('\n  ');
  const subtitleY = HEIGHT - 92;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${renderEditorialBackground(backgroundPath)}

  <!-- Headline -->
  ${headlineSvg}

  <!-- Original source title -->
  ${sourceTitleSvg}

  <!-- Subtitle -->
  <text x="${WIDTH / 2}" y="${subtitleY}" text-anchor="middle"
        font-family="${sansStack}" font-size="22" fill="${cover.sub}">이윤철이 오늘 읽은 아티클</text>
</svg>`;
}

function fitHeadline(text: string): { lines: string[]; font: number; gap: number } {
  const tiers: { font: number; advance: number; gap: number }[] = [
    { font: 176, advance: 175, gap: 196 },
    { font: 144, advance: 143, gap: 164 },
    { font: 120, advance: 119, gap: 138 },
    { font: 100, advance: 99, gap: 116 },
    { font: 88, advance: 87, gap: 104 },
    { font: 80, advance: 79, gap: 94 },
    { font: 72, advance: 71, gap: 86 },
  ];
  const targetMaxLines = 3;

  for (const tier of tiers) {
    const budget = (WIDTH - spacing.page - 0.5 * tier.advance) / tier.advance;
    const lines = wrapByWidth(text, budget);
    if (lines.length <= targetMaxLines || tier === tiers[tiers.length - 1]) {
      return { lines, font: tier.font, gap: tier.gap };
    }
  }

  return { lines: [text], font: 72, gap: 86 };
}

function charWeight(ch: string): number {
  if (/[぀-ヿ㐀-䶿一-鿿가-힯＀-￯]/.test(ch)) {
    return 1.0;
  }
  if (ch === ' ' || /[.,!?;:'"()\[\]{}·—–-]/.test(ch)) {
    return 0.4;
  }
  return 0.55;
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

function clampLines(lines: string[], maxLines: number): string[] {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.…]+$/g, '')}...`;
  return kept;
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
