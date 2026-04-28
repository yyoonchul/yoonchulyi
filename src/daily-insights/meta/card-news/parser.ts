import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DigestData, ArticleData, CoverData } from './types.js';

const KO_START = '<!-- LANG:KO:START -->';
const KO_END = '<!-- LANG:KO:END -->';

export function parseDigest(datePath: string): DigestData {
  const contentDir = resolve(import.meta.dirname, '../../content');
  const filePath = resolve(contentDir, `${datePath}.md`);
  const raw = readFileSync(filePath, 'utf-8');

  const koMarkdown = extractKoSection(raw);
  const cover = parseCover(koMarkdown, datePath);
  const articles = parseArticles(koMarkdown);

  return { datePath, cover, articles };
}

function extractKoSection(body: string): string {
  const startIdx = body.indexOf(KO_START);
  const endIdx = body.indexOf(KO_END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('KO language markers not found');
  }
  return body.slice(startIdx + KO_START.length, endIdx).trim();
}

function parseCover(ko: string, datePath: string): CoverData {
  const [year, month, day] = datePath.split('/');
  const date = `${year}년 ${Number(month)}월 ${Number(day)}일`;

  const countMatch = ko.match(/^>\s*(\d+)건\s*정리\s*\|\s*(.+)$/m);
  const articleCount = countMatch ? Number(countMatch[1]) : 0;
  const categories = countMatch
    ? countMatch[2].split(',').map((c) => c.trim())
    : [];

  return { date, articleCount, categories };
}

function parseArticles(ko: string): ArticleData[] {
  const summarySection = extractSection(ko, '## 📋 간단 요약', '## 📝');
  const summaryBlocks = splitByH3(summarySection);

  return summaryBlocks.map((block, i) => {
    const title = block.title;
    const { source, category } = parseMetaLine(block.body);
    const bullets = block.body
      .split('\n')
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2).trim());

    return { index: i + 1, title, source, category, bullets };
  });
}

function extractSection(
  ko: string,
  startHeading: string,
  endHeading: string | null,
): string {
  const startIdx = ko.indexOf(startHeading);
  if (startIdx === -1) return '';

  const afterStart = ko.slice(startIdx + startHeading.length);
  if (!endHeading) return afterStart.trim();

  const endIdx = afterStart.indexOf(endHeading);
  return endIdx === -1 ? afterStart.trim() : afterStart.slice(0, endIdx).trim();
}

function splitByH3(section: string): { title: string; body: string }[] {
  const blocks: { title: string; body: string }[] = [];
  const lines = section.split('\n');
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith('### ') && !line.match(/^### \d+\./)) {
      if (current) blocks.push({ title: current.title, body: current.lines.join('\n') });
      current = { title: line.slice(4).trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push({ title: current.title, body: current.lines.join('\n') });

  return blocks;
}

function parseMetaLine(body: string): { source: string; category: string } {
  const sourceLine = body.match(
    /\*\*출처:\*\*\s*(.+?)\s*·\s*\*\*카테고리:\*\*\s*(.+?)\s*·/,
  );
  // YouTube format
  const ytLine = body.match(
    /\*\*출처:\*\*\s*(.+?)\s*·\s*\*\*채널:\*\*/,
  );
  const ytCategory = body.match(/\*\*카테고리:\*\*\s*(.+?)\s*·/);

  if (sourceLine) {
    return { source: sourceLine[1].trim(), category: sourceLine[2].trim() };
  }
  if (ytLine) {
    return {
      source: ytLine[1].trim(),
      category: ytCategory ? ytCategory[1].trim() : 'Misc',
    };
  }
  return { source: '', category: '' };
}
