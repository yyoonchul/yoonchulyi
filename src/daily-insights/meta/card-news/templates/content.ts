import { WIDTH, HEIGHT, font, spacing } from './styles.js';
import {
  editorialColors as cover,
  editorialSansStack as sansStack,
  renderEditorialBackground,
  renderEditorialTextBackdrop,
} from './editorial-background.js';
import type { ArticleData } from '../types.js';

// 한 슬라이드 = 한 기사의 한 불렛.
// 헤더는 그 불렛 자체를 요약한 짧은 한글 한 줄.
export function renderContent(
  article: ArticleData,
  header: string,
  bullet: string,
  pageNum: number,
  totalPages: number,
  backgroundPath?: string | null,
): string {
  const headerText = (header || article.title).trim();
  // 헤더 폰트: 130. 우측은 글자 절반 폭(≈65px)만 여백으로 남기고 끝까지 사용.
  // usable 폭 = 1080 - 80(left) - 65(half glyph) ≈ 935 → 935/129(advance) ≈ 7.25 → 7 chars/line.
  const headerFontSize = 130;
  const headerPerLine = 7;
  const headerLineHeight = 144;
  const headerLines = wrapText(headerText, headerPerLine);
  // 헤더 글자의 "상단"이 캔버스 정중앙(HEIGHT/2)에 오도록 한다.
  // SVG의 y는 baseline 좌표이므로, 첫 줄 baseline = 정중앙 + cap height(≈ font * 0.78).
  const headerStartY = Math.round(HEIGHT / 2 + headerFontSize * 0.78);
  const headerEl = headerLines
    .map(
      (line, i) =>
        `<text x="${spacing.page}" y="${headerStartY + i * headerLineHeight}"
          font-family="${sansStack}" font-size="${headerFontSize}" font-weight="700" fill="${cover.text}" letter-spacing="-1">${escSvg(line)}</text>`,
    )
    .join('\n  ');

  // 본문: 불렛 1개를 텍스트로 렌더. 캔버스 하단 가까이에 배치한다.
  // 24px body, 우측 절반-글자 여백(≈12) → usable ~988 → 988/24 ≈ 41 → 40자.
  const bodyLines = wrapText(bullet, 40);
  const bodyLineHeight = 40;
  const bodyBottomMargin = 110; // 캔버스 하단에서의 여백
  const bodyHeight = bodyLines.length * bodyLineHeight;
  const bodyStartY = HEIGHT - bodyBottomMargin - (bodyHeight - bodyLineHeight);
  const bodyEls = bodyLines
    .map(
      (line, i) =>
        `<text x="${spacing.page + 28}" y="${bodyStartY + i * bodyLineHeight}"
          font-family="${sansStack}" font-size="${font.body}" fill="${cover.sub}">${escSvg(line)}</text>`,
    )
    .join('\n  ');
  const bulletDot = `<circle cx="${spacing.page + 8}" cy="${bodyStartY - 10}" r="4" fill="${cover.accent}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${renderEditorialBackground(backgroundPath)}
  ${renderEditorialTextBackdrop()}

  <!-- Header (centered) -->
  ${headerEl}

  <!-- Bullet body -->
  ${bulletDot}
  ${bodyEls}
</svg>`;
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    let breakAt = remaining.lastIndexOf(' ', maxChars);
    if (breakAt <= 0) breakAt = maxChars;
    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  if (remaining) lines.push(remaining);
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
