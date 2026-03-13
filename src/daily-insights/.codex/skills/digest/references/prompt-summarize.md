# Summarization Prompt Guide (EN -> KO)

## Language Policy

1. Create the digest in **English** first.
2. Translate the full EN digest into **Korean**.
3. Keep EN and KO sections semantically aligned.

## Tone and Quality

- Fact-based, concise, and specific.
- No fabricated claims.
- Preserve numbers, names, and links.

## Allowed Categories

Choose one per article:

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

## Quick Summary (3 bullets)

- Exactly 3 bullets per article.
- Each bullet should capture one concrete takeaway.
- Include metrics/numbers when available.

## Detailed Notes

- Do not output one flat bullet list.
- Keep article order consistent with quick summary order.
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

## Failure Handling

If source cannot be fetched:

- Keep title/source/link.
- Add `⚠️ Fetch failed` in quick summary.
- Omit detailed notes for that article.

## summary-only Memo

If memo contains `summary-only`:

- Keep quick summary.
- Omit detailed notes for that article.
