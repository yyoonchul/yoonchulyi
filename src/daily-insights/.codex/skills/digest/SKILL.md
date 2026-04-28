---

## name: digest description: &gt; Use this skill to read URLs from content/inbox.md, collect source content, and generate a bilingual daily digest file at content/YYYY/MM/DD.md. Korean is the source of truth: write the digest in Korean first, then translate it to English. The output file must keep EN section first, then KO section, in one file with fixed markers.

# Daily Digest (KO -&gt; EN)

Generate or update one daily digest markdown file from `content/inbox.md`.

## Inputs

- `content/inbox.md`: one URL per line, optional `# note` suffix.

## Outputs

- `content/YYYY/MM/DD.md`: bilingual digest in one file.
- `content/index.json`: keep latest-first date paths (`YYYY/MM/DD`).
- `content/inbox.md`: clear after successful processing.

## Execution Flow

### 1. Read inbox

- Parse URL lines from `content/inbox.md`.
- Ignore blank lines and comment-only lines.
- Extract optional memo after `#`.
- Stop with `📭 Inbox is empty.` if no valid URLs.
- De-duplicate normalized URLs.

### 2. Collect source content

For each URL:

- **YouTube URLs** (`youtube.com`, `youtu.be`): Run `scripts/fetch-yt-transcript.sh <URL>` to extract transcript and metadata (title, channel, duration). Use the transcript text as source content. If transcript extraction fails, mark as `⚠️ Transcript unavailable`.
- **X / Twitter URLs** (`x.com`, `twitter.com`): A direct fetch of the status page returns only a JS shell — for short tweets it surfaces OG meta with the tweet text, but for X long-form Articles (`x.com/i/article/...` chains) it returns only a bare `t.co` redirect. Do NOT follow that `t.co` to `x.com/i/article/...` and re-fetch — that destination is auth-walled and returns "Page not found" to bots. Instead, on the **original status URL**:
  1. Fetch the original status URL first. If the body contains the tweet text, you are done.
  2. If the body is empty / only a `t.co` link / clearly an X Article wrapper, fetch `curl -sS -L https://api.fxtwitter.com/<screen_name>/status/<status_id>`. That JSON has `tweet.raw_text.text`, `tweet.author.name`, `tweet.created_at`, and for X Articles a `tweet.article.{title, preview_text}` field (preview only, not full body).
  3. If only `article.{title, preview_text}` is available, summarize from title + preview and add a `⚠️ Article preview only — body not retrievable` note. Only mark `⚠️ Fetch failed` when fxtwitter also returns nothing usable.
- **Other URLs**: Fetch article content and metadata (title, source, publish date if available). If fetch fails, keep title/link and mark as `⚠️ Fetch failed`.

### 3. Summarize in Korean first

Follow `references/prompt-summarize.md`:

- Select one category from the allowed list.
- Produce 3 bullet quick summary.
- Produce detailed notes with structured lists (not a flat bullet dump).
- Detailed notes: 20-30 lines per article.
- 상세 정리: 기사별 20-30줄.
- Use numbered major points, and under each major point add indented bullet lists for detailed notes.
- Use plain declarative form (`-다` 체), not polite form (`-ㅂ니다`/`-습니다` 체). See `references/prompt-summarize.md` → "Korean Style".
- If memo includes `summary-only`, skip detailed notes for that item.

### 4. Translate KO output to English

- Translate the generated KO digest into natural English.
- Preserve structure, order, numbering, and links.
- Do not invent facts.

### 5. Write one bilingual markdown file

Use the fixed template in `assets/template-daily.md`.

- EN section MUST come first in the output file (translated from the KO source).
- KO section MUST come second.
- Use fixed markers exactly:
  - `<!-- LANG:EN:START -->`
  - `<!-- LANG:EN:END -->`
  - `<!-- LANG:KO:START -->`
  - `<!-- LANG:KO:END -->`

### 6. Update index

- Ensure today's `YYYY/MM/DD` path exists at the front of `content/index.json`.
- Do not insert duplicates.

### 7. Clear inbox

- Empty `content/inbox.md` content.

### 8. Optional git actions

Only if explicitly requested by user:

- Stage `content/YYYY/MM/DD.md`, `content/index.json`, `content/inbox.md`.
- Commit message: `Add daily digest for YYYY-MM-DD`.
- Push only if requested.

### 9. Completion report

Report:

- Number of processed items
- Output file path
- Failed URLs (if any)
