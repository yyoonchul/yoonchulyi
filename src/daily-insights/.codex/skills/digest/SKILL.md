---

## name: digest description: &gt; Use this skill to read URLs from content/inbox.md, collect source content, and generate a bilingual daily digest file at content/YYYY/MM/DD.md. The output must be EN first, then KO translation, in one file with fixed markers.

# Daily Digest (EN -&gt; KO)

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

- Fetch article content and metadata (title, source, publish date if available).
- If fetch fails, keep title/link and mark as `⚠️ Fetch failed`.

### 3. Summarize in English first

Follow `references/prompt-summarize.md`:

- Select one category from the allowed list.
- Produce 3 bullet quick summary.
- Produce detailed notes with structured lists (not a flat bullet dump).
- Detailed notes: 20-30 lines per article.
- 상세 정리: 기사별 20-30줄.
- Use numbered major points, and under each major point add indented bullet lists for detailed notes.
- If memo includes `summary-only`, skip detailed notes for that item.

### 4. Translate EN output to Korean

- Translate the generated EN digest into natural Korean.
- Preserve structure, order, numbering, and links.
- Do not invent facts.

### 5. Write one bilingual markdown file

Use the fixed template in `assets/template-daily.md`.

- EN section MUST come first.
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
