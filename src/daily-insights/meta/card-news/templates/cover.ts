import { WIDTH, HEIGHT, fontFamily, font, spacing } from './styles.js';
import {
  editorialColors as cover,
  editorialSansStack as sansStack,
  renderEditorialBackground,
} from './editorial-background.js';
import type { CoverData } from '../types.js';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// "2026년 4월 21일" 같은 값을 "2026.04.21 MON" 포맷으로 변환한다.
function formatDate(dateStr: string): string {
  const m = dateStr.match(/(\d{4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
  if (!m) return dateStr;
  const [, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  const dow = WEEKDAYS[dt.getDay()] ?? '';
  return `${y}.${mo.padStart(2, '0')}.${d.padStart(2, '0')} ${dow}`.trim();
}

export function renderCover(data: CoverData, backgroundPath?: string | null): string {
  const dateLine = formatDate(data.date);

  // 헤드라인: 스킬이 생성한 메인 제목을 길이에 맞춰 폰트를 줄이고
  // 폭에 맞게 자동 줄바꿈한다.
  // 폴백: headlineLines → categories → 기본값.
  const candidate =
    data.headlineLines && data.headlineLines.length > 0
      ? data.headlineLines
      : data.categories.length > 0
        ? data.categories
        : ['오늘 뉴스', '핵심 이슈'];
  const headlineText = candidate
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');

  // 폰트 tier 후보 (큰 → 작은). 각 tier마다 advance / per-line pixel budget 정의.
  // budget = 1080 - 80(left) - 0.5*advance (글자 절반 폭의 우측 여백).
  const tiers: { font: number; advance: number; gap: number }[] = [
    { font: 176, advance: 175, gap: 196 },
    { font: 144, advance: 143, gap: 164 },
    { font: 120, advance: 119, gap: 138 },
    { font: 100, advance: 99, gap: 116 },
    { font: 88, advance: 87, gap: 104 },
    { font: 80, advance: 79, gap: 94 },
    { font: 72, advance: 71, gap: 86 },
  ];
  const TARGET_MAX_LINES = 3;
  const usableWidth = (advance: number) =>
    WIDTH - spacing.page - 0.5 * advance;

  // 가장 큰 폰트 중 줄 수가 TARGET_MAX_LINES 이하인 것을 고르고,
  // 마지막 tier까지도 못 맞추면 가장 작은 tier를 사용한다.
  let chosen = tiers[tiers.length - 1];
  let chosenLines: string[] = [];
  for (const tier of tiers) {
    const budget = usableWidth(tier.advance) / tier.advance;
    const lines = wrapByWidth(headlineText, budget);
    if (lines.length <= TARGET_MAX_LINES || tier === tiers[tiers.length - 1]) {
      chosen = tier;
      chosenLines = lines;
      break;
    }
  }
  // 만약 가장 작은 tier도 줄 수가 너무 많으면 그대로 사용.
  if (chosenLines.length === 0) {
    const tier = tiers[tiers.length - 1];
    chosen = tier;
    chosenLines = wrapByWidth(headlineText, usableWidth(tier.advance) / tier.advance);
  }

  const rawLines = chosenLines;
  const sizing = { font: chosen.font, gap: chosen.gap };
  const lineCount = rawLines.length;
  const headlineFontSize = sizing.font;
  const headlineGap = sizing.gap;
  const headlineBlockHeight = (lineCount - 1) * headlineGap;
  const headlineCenterY = HEIGHT / 2 + 40;
  const headlineStartY = headlineCenterY - headlineBlockHeight / 2;
  const headlineSvg = rawLines
    .map((t, i) => {
      const y = headlineStartY + i * headlineGap;
      return `<text x="${spacing.page}" y="${y}" font-family="${sansStack}" font-size="${headlineFontSize}" font-weight="700" fill="${cover.text}" letter-spacing="-1">${escSvg(t)}</text>`;
    })
    .join('\n  ');

  const dateY = HEIGHT - 170;
  const subtitleY = dateY + 48;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${renderEditorialBackground(backgroundPath)}

  <!-- Headline -->
  ${headlineSvg}

  <!-- Date -->
  <text x="${spacing.page}" y="${dateY}"
        font-family="${fontFamily.mono}" font-size="${font.small}" fill="${cover.accent}" letter-spacing="4">${escSvg(dateLine)}</text>

  <!-- Subtitle -->
  <text x="${spacing.page}" y="${subtitleY}"
        font-family="${sansStack}" font-size="${font.subtitle}" fill="${cover.sub}">서울대 공대생이 오늘 읽은 테크 뉴스</text>
</svg>`;
}

// CJK는 글자 advance 1단위, ASCII 영숫자는 약 0.55, 공백/문장부호는 약 0.4.
function charWeight(ch: string): number {
  // CJK Hanzi/Hiragana/Katakana/Hangul/Fullwidth
  if (/[぀-ヿ㐀-䶿一-鿿가-힯＀-￯]/.test(ch)) {
    return 1.0;
  }
  if (ch === ' ' || /[.,!?;:'"()\[\]{}·—–-]/.test(ch)) {
    return 0.4;
  }
  return 0.55;
}

// 픽셀 폭 기준으로 줄바꿈. budget = 한 줄에 들어갈 수 있는 weight 합계.
// 가능하면 ", " 직후에서 끊고, 안 되면 공백, 그것도 안 되면 강제 절단.
function wrapByWidth(text: string, budget: number): string[] {
  const lines: string[] = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    // 첫 번째 단계: budget을 넘기는 글자 위치 cutAt을 찾는다.
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

    // 더 이상 자를 필요 없으면 한 줄에 모두 출력하고 종료.
    if (cutAt === -1) {
      lines.push(remaining);
      break;
    }

    // 두 번째 단계: cutAt 위치까지의 break 후보(", " 또는 " ") 중 가장 늦은 위치를
    // 선택한다. break 캐릭터(공백/쉼표) 자체는 trimEnd로 제거되므로 cutAt 위치에서
    // budget을 넘긴 공백이라도 그 공백에서 끊으면 텍스트 폭은 그대로다.
    const commaIdx = remaining.lastIndexOf(', ', cutAt);
    const spaceIdx = remaining.lastIndexOf(' ', cutAt);
    const commaBreak = commaIdx > 0 ? commaIdx + 2 : -1;
    const spaceBreak = spaceIdx > 0 ? spaceIdx + 1 : -1;
    let breakAt = Math.max(commaBreak, spaceBreak);
    if (breakAt <= 0) breakAt = cutAt; // 어떠한 break point도 없으면 강제 절단

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
