/**
 * The handoff between the deterministic half of the weekly letter and the agent.
 *
 * `plan` writes a working directory for the week; an agent reads the brief and
 * drops one `headline.json` into it; `send` reads both back. Keeping the handoff
 * on disk means the agent never touches Resend, the state file, or the letter's
 * markup — it writes five short strings and nothing else.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { DigestDay, WeekWindow } from './digest.ts';
import type { Language } from './shared.ts';

const WORKSPACE_ROOT = new URL('../../.newsletter-weekly/', import.meta.url);

export const LANGUAGES: Language[] = ['en', 'ko'];

export interface WeekPlan {
  window: WeekWindow;
  weeks: Record<Language, DigestDay[]>;
}

export interface WeeklyHeadline {
  /** The story the subject line was drawn from, echoed back for the run log. */
  lead: string;
  subject: Record<Language, string>;
  tldr: Record<Language, string[]>;
}

export function workspaceDir(window: WeekWindow): string {
  return new URL(`${window.start}/`, WORKSPACE_ROOT).pathname;
}

export function headlinePath(window: WeekWindow): string {
  return `${workspaceDir(window)}headline.json`;
}

export function briefPath(window: WeekWindow): string {
  return `${workspaceDir(window)}brief.md`;
}

export function writePlan(plan: WeekPlan): void {
  const dir = workspaceDir(plan.window);
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}week.json`, `${JSON.stringify(plan, null, 2)}\n`);
  writeFileSync(briefPath(plan.window), renderBrief(plan));
}

export function readPlan(window: WeekWindow): WeekPlan {
  const path = `${workspaceDir(window)}week.json`;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as WeekPlan;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `No week prepared at ${path} — run \`weekly.ts plan\` first, or wait for the Mac to push one.`,
      );
    }
    throw error;
  }
}

/**
 * Everything the agent needs to choose a lead story, and nothing else — no
 * instructions, no schema. Those live in the skill, which is versioned
 * separately from the week's data.
 */
function renderBrief(plan: WeekPlan): string {
  const lines = [
    `# Daily Insights — week of ${plan.window.start} to ${plan.window.end}`,
    '',
    `Write \`headline.json\` in this directory. Nothing else in here is yours to edit.`,
    '',
  ];

  for (const language of LANGUAGES) {
    lines.push(`## ${language.toUpperCase()}`, '');
    for (const day of plan.weeks[language]) {
      lines.push(`### ${day.isoDate}`, '');
      for (const article of day.articles) {
        lines.push(`#### ${article.title}`);
        if (article.meta) {
          lines.push(article.meta);
        }
        lines.push(...article.bullets.map((bullet) => `- ${bullet}`), '');
      }
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * The agent writes free text into a fixed shape, so every field is checked
 * before it can reach an inbox. A malformed headline fails the run rather than
 * shipping a letter with a missing subject line or four TL;DR bullets.
 */
export function readHeadline(window: WeekWindow): WeeklyHeadline {
  const path = headlinePath(window);
  let parsed: unknown;

  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`No headline yet — expected an agent to write ${path}`);
    }
    throw new Error(`${path} is not valid JSON: ${String(error)}`);
  }

  const headline = parsed as Partial<WeeklyHeadline>;
  const problems: string[] = [];

  if (!headline.lead?.trim()) {
    problems.push('"lead" is missing');
  }

  for (const language of LANGUAGES) {
    const subject = headline.subject?.[language];
    if (typeof subject !== 'string' || !subject.trim()) {
      problems.push(`"subject.${language}" is missing`);
    } else if (subject.length > 120) {
      problems.push(`"subject.${language}" is ${subject.length} characters — keep it under 120`);
    }

    const tldr = headline.tldr?.[language];
    if (!Array.isArray(tldr) || tldr.length !== 3) {
      problems.push(`"tldr.${language}" must have exactly 3 lines, got ${tldr?.length ?? 0}`);
    } else if (tldr.some((line) => typeof line !== 'string' || !line.trim())) {
      problems.push(`"tldr.${language}" has an empty line`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`${path} is not usable:\n  - ${problems.join('\n  - ')}`);
  }

  return headline as WeeklyHeadline;
}

/**
 * Used by `--preview` before any agent has run: keeps the layout honest while
 * making it obvious the copy is not the real thing.
 */
export function placeholderHeadline(weeks: Record<Language, DigestDay[]>): WeeklyHeadline {
  const pick = (language: Language, index: number) =>
    weeks[language].flatMap((day) => day.articles)[index];

  return {
    lead: pick('en', 0)?.title ?? '',
    subject: {
      en: `[placeholder] ${pick('en', 0)?.title ?? 'Weekly digest'}`,
      ko: `[placeholder] ${pick('ko', 0)?.title ?? '주간 다이제스트'}`,
    },
    tldr: {
      en: [0, 1, 2].map((i) => pick('en', i)?.bullets[0] ?? '[placeholder line]'),
      ko: [0, 1, 2].map((i) => pick('ko', i)?.bullets[0] ?? '[임시 문장]'),
    },
  };
}
