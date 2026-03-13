# Daily Digest Skill (EN -> KO)

Generate or update one daily digest file from `content/inbox.md`.

## Inputs

- `content/inbox.md`: URL list (optional memo with `#`).

## Outputs

- `content/YYYY/MM/DD.md`: bilingual digest (EN then KO).
- `content/index.json`: latest-first date list.
- `content/inbox.md`: cleared after processing.

## Workflow

1. Read and parse inbox URLs.
2. Fetch source contents and metadata.
3. Create digest in English first (summary + detail).
   - Detailed notes: 20-30 lines per article.
   - 상세 정리: 기사별 20-30줄.
   - Use numbered major points, and under each major point add indented bullet lists for detailed notes.
4. Translate that digest into Korean.
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
