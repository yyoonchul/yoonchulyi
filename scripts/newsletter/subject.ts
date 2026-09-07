import type { WeekWindow } from './digest.ts';
import type { Language } from './shared.ts';

/** The Thursday assigns a Monday–Sunday week to its majority month. */
export function weeklySubject(language: Language, window: WeekWindow, headline: string): string {
  const thursday = new Date(`${window.start}T00:00:00Z`);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const week = Math.ceil(thursday.getUTCDate() / 7);
  const month = thursday.getUTCMonth() + 1;
  const monthName = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(thursday);
  const prefix = language === 'ko'
    ? `[${month}월 ${week}주차 아티클 모음]`
    : `[${monthName} Week ${week} Article Roundup]`;
  return `${prefix} ${headline}`;
}
