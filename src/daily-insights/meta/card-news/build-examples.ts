/**
 * 템플릿 예시 SVG 생성
 *
 * templates/ 폴더에 예시 데이터가 반영된 SVG를 생성한다.
 * 디자인 도구에서 열어 레이아웃/색상을 확인하고 수정할 수 있다.
 *
 * Usage: npx tsx build-examples.ts
 */
import { writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderCover } from './templates/cover.js';
import { renderContent } from './templates/content.js';
import type { CoverData, ArticleData } from './types.js';

const sampleCover: CoverData = {
  date: '2026년 4월 13일',
  articleCount: 2,
  categories: ['DevTools', 'AI'],
  // 커버 = 하루 전체를 관통하는 메인 제목 하나.
  headlineLines: ['AI가 일하는 방식을 다시 쓴다'],
};

const sampleArticle: ArticleData = {
  index: 1,
  title: 'OpenClaw 기반 AI 비서를 만들어 인간 비서보다 낫게 만든 방법',
  source: 'X',
  category: 'DevTools',
  bullets: [
    'Ryan Sarver가 OpenClaw 기반 비서 Stella를 공개했다. 지속 메모리, 미팅 준비, 태스크 추적을 결합해 인간 비서를 대체했다고 주장한다.',
    '핵심은 마크다운 메모리 두 층이다. 하루 단위 원시 로그와 장기 지식을 모은 MEMORY.md를 분리하고, 결정론적 작업은 스크립트가 맡는다.',
    '진짜 차별점은 주간 개선 루프다. 새로운 패턴을 조사하고 수정 사항에서 배우며 시스템을 계속 리팩터링한다.',
  ],
  bulletHeaders: [
    'Stella, 인간 비서 대체',
    '마크다운 메모리 두 층',
    '주간 개선 루프 핵심',
  ],
};

const totalPages = 1 + sampleArticle.bullets.length;

const templatesDir = resolve(import.meta.dirname, 'templates');

const coverSvg = renderCover(sampleCover).replace('{{totalPages}}', String(totalPages));
writeFileSync(resolve(templatesDir, 'cover.example.svg'), coverSvg, 'utf-8');

const contentSvg = renderContent(
  sampleArticle,
  sampleArticle.bulletHeaders![0],
  sampleArticle.bullets[0],
  2,
  totalPages,
);
writeFileSync(resolve(templatesDir, 'content.example.svg'), contentSvg, 'utf-8');

// 구 템플릿 잔해 청소
for (const stale of ['summary.example.svg', 'insight.example.svg']) {
  try {
    rmSync(resolve(templatesDir, stale));
  } catch {
    /* not present, ok */
  }
}

console.log('Example SVGs generated in templates/');
console.log('  cover.example.svg');
console.log('  content.example.svg');
