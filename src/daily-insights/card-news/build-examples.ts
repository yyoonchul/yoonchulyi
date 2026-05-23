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
import { renderArticleCover } from './templates/article-cover.js';
import { renderArticleContent } from './templates/article-content.js';
import type { ArticleData } from './types.js';

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
  detailSections: [
    {
      header: '마찰은 유용한 신호다',
      body: [
        '어려운 엔지니어링 작업은 과거에는 엔지니어가 머릿속에 모델을 만들도록 강제했다.',
        'AI는 대안, 실패 모드, 2차 효과와 씨름하는 어려운 구간을 제거할 수 있다.',
        '그 결과 산출물은 유창하고 구조화되어 있어 이해한 것처럼 느껴지지만, 실제 사고 근육은 생기지 않을 수 있다.',
      ],
    },
  ],
};

const templatesDir = resolve(import.meta.dirname, 'templates');

const articleCoverSvg = renderArticleCover(
  sampleArticle,
  'AI 시대의 사고 검증',
  'Ryan Sarver의 "OpenClaw 기반 AI 비서를 만들어 인간 비서보다 낫게 만든 방법"',
);
writeFileSync(resolve(templatesDir, 'article-cover.example.svg'), articleCoverSvg, 'utf-8');

const articleContentSvg = renderArticleContent(
  sampleArticle.detailSections![0],
  2,
  1 + sampleArticle.detailSections!.length,
);
writeFileSync(resolve(templatesDir, 'article-content.example.svg'), articleContentSvg, 'utf-8');

// 구 템플릿 잔해 청소
for (const stale of ['cover.example.svg', 'content.example.svg', 'summary.example.svg', 'insight.example.svg']) {
  try {
    rmSync(resolve(templatesDir, stale));
  } catch {
    /* not present, ok */
  }
}

console.log('Example SVGs generated in templates/');
console.log('  article-cover.example.svg');
console.log('  article-content.example.svg');
