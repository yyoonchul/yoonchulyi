# Summarization Prompt Guide (KO -> EN)

## Language Policy

1. Create the digest in **Korean** first.
2. Translate the full KO digest into **English**.
3. Keep KO and EN sections semantically aligned.

## Korean Style

- Use plain declarative form (`-다` 체), not polite form (`-ㅂ니다`/`-습니다` 체).
  - Example: `발표했다`, `제공한다`, `~로 보인다` (○) / `발표했습니다`, `제공합니다` (✗).
- Apply this consistently across quick summary, detailed notes, and any prose lines.

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
- 기사별 상세 정리는 20-30줄로 작성한다.

### Required List Style Per Article

Formatting rules:

- Use numbered major points (`1.`, `2.`, `3.` ...) for the main storyline.
- Under each major point, add 2-4 indented bullets with concrete details.
- Detail bullets can include facts, numbers, implications, caveats, or assumptions as needed.
- Write 2-5 major points per article, and keep total 20-30 lines.
- Prefer concrete facts, named entities, numbers, and explicit assumptions.
- Avoid repeating the same point across major points.
- Do not enforce fixed sub-labels (for example `Evidence:`, `Why it matters:`, `Caveat:`).

## YouTube / Video Content

When the source is a YouTube video (transcript extracted via `scripts/fetch-yt-transcript.sh`):

- **Source**: `YouTube`
- **Metadata line**: `**Source:** YouTube · **Channel:** {Channel} · **Duration:** {Duration} · **Category:** {Category} · **Link:** [Original]({URL})`
- Summarize based on the transcript text, not the video description.
- Convert spoken/colloquial language into structured written form.
- Focus on the speaker's key arguments, demonstrations, or announcements.
- If the transcript is very long, prioritize the main thesis and concrete examples over tangential remarks.

## X / Twitter Sources

When the source is an `x.com` or `twitter.com` URL:

- **Source**: `X`
- **Metadata line**: `**Source:** X · **Author:** {Author or @handle} · **Category:** {Category} · **Link:** [Original]({URL})`
- A plain fetch on a status URL only returns OG meta. For short tweets that is enough; for X long-form Articles (`x.com/i/article/...` chains) it is not — fall back to `api.fxtwitter.com/<user>/status/<id>` as described in `SKILL.md` step 2.
- Do not follow an embedded `t.co` link to `x.com/i/article/...` and try to fetch that destination directly: it is auth-walled and returns "Page not found" to bots. Always run the fallback against the original status URL.
- When fxtwitter returns only `article.{title, preview_text}`, summarize from that and label the article `⚠️ Article preview only — body not retrievable`. Reserve `⚠️ Fetch failed` for the case where even fxtwitter returns nothing.

## Failure Handling

If source cannot be fetched:

- Keep title/source/link.
- Add `⚠️ Fetch failed` in quick summary.
- Omit detailed notes for that article.

If YouTube transcript cannot be extracted:

- Keep title/source/link.
- Add `⚠️ Transcript unavailable` in quick summary.
- Omit detailed notes for that article.

## summary-only Memo

If memo contains `summary-only`:

- Keep quick summary.
- Omit detailed notes for that article.
