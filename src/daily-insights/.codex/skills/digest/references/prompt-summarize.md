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

- Start from key announcement or core argument.
- Structure content with first-level bullets or numbered points.
- Keep order consistent with quick summary order.

## Failure Handling

If source cannot be fetched:

- Keep title/source/link.
- Add `⚠️ Fetch failed` in quick summary.
- Omit detailed notes for that article.

## summary-only Memo

If memo contains `summary-only`:

- Keep quick summary.
- Omit detailed notes for that article.
