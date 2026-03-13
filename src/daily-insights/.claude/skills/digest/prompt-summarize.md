# Summarization Prompt Guide

## Language Order

- Write **English** digest first.
- Then produce **Korean** translation from that English version.

## Tone

- Accurate, concise, and factual.
- No invented facts.

## Categories

Choose one:

- AI
- DevTools
- Cloud
- Security
- Frontend
- Backend
- Business
- Open Source
- HN
- Misc

## Quick Summary

- 3 bullets per article.
- Include concrete facts or numbers where possible.

## Detailed Notes

- Do not output one flat bullet list.
- Keep article order consistent with quick summary.
- Write detailed notes in 20-30 lines per article.
- 기사별 상세 정리는 20-30줄로 작성합니다.

### Required List Style Per Article

Formatting rules:

- Use numbered major points (`1.`, `2.`, `3.` ...) for the main storyline.
- Under each major point, add 2-4 indented bullets with concrete details.
- Detail bullets can include facts, numbers, implications, caveats, or assumptions as needed.
- Write 2-5 major points per article, and keep total 20-30 lines.
- Prefer concrete facts, named entities, numbers, and explicit assumptions.
- Avoid repeating the same point across major points.
- Do not enforce fixed sub-labels (for example `Evidence:`, `Why it matters:`, `Caveat:`).

## Exceptions

- If fetch fails: mark `⚠️ Fetch failed`, skip detailed notes.
- If memo contains `summary-only`: skip detailed notes for that item.
