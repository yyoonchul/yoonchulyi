# Daily Digest Skill (KO -> EN)

Generate or update one daily digest file from `content/inbox.md`.

Korean is the source of truth: write the digest in Korean first, then translate it into English.

## Inputs

- `content/inbox.md`: URL list (optional memo with `#`).

## Outputs

- `content/YYYY/MM/DD.md`: bilingual digest (EN then KO).
- `content/index.json`: latest-first date list.
- `content/inbox.md`: cleared after processing.

## Workflow

1. Read and parse inbox URLs.
2. Fetch source contents and metadata.
   - **YouTube URLs** (`youtube.com`, `youtu.be`): Run `scripts/fetch-yt-transcript.sh <URL>` to extract transcript and metadata (title, channel, duration). Use the transcript text as source content.
   - **X / Twitter URLs** (`x.com`, `twitter.com`): A direct WebFetch on the status page returns only a JS shell — for short tweets it surfaces OG meta with the tweet text, but for X long-form Articles (`x.com/i/article/...` chains) it returns only a bare `t.co` redirect. Do NOT follow that `t.co` to `x.com/i/article/...` and re-fetch — that destination is auth-walled and returns "Page not found" to bots. Instead, on the **original status URL**:
     1. Try `WebFetch <original-status-url>` first. If the body contains the tweet text, you are done.
     2. If the body is empty / only a `t.co` link / clearly an X Article wrapper, fetch `curl -sS -L https://api.fxtwitter.com/<screen_name>/status/<status_id>`. That JSON has `tweet.raw_text.text`, `tweet.author.name`, `tweet.created_at`, and for X Articles a `tweet.article.{title, preview_text}` field (preview only, not full body).
     3. If only `article.{title, preview_text}` is available, summarize from title + preview and add a `⚠️ Article preview only — body not retrievable` note. Only mark `⚠️ Fetch failed` when fxtwitter also returns nothing usable.
   - **Other URLs**: Fetch via standard web fetch.
   - If YouTube transcript extraction fails: mark `⚠️ Transcript unavailable`, skip detailed notes.
3. Create digest in Korean first (summary + detail).
   - Use plain declarative form (`-다` 체), not polite form (`-ㅂ니다`/`-습니다` 체). See `prompt-summarize.md` → "Korean Style".
   - Detailed notes: 20-30 lines per article.
   - 상세 정리: 기사별 20-30줄.
   - Use numbered major points, and under each major point add indented bullet lists for detailed notes.
4. Translate that Korean digest into English.
   - Preserve structure, order, numbering, and links.
5. Write one file with fixed markers:
   - `<!-- LANG:EN:START -->`
   - `<!-- LANG:EN:END -->`
   - `<!-- LANG:KO:START -->`
   - `<!-- LANG:KO:END -->`
6. Update index and clear inbox.
7. Report processed count/output path/failures.

## References

- Prompt guide: `prompt-summarize.md`
- Output template: `template-daily.md`
