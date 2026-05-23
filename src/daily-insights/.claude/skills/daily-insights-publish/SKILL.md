---
name: daily-insights-publish
description: Commit and push the generated Daily Insights digest, card news sidecars, and public cardnews URL assets so GitHub Pages deploys them together.
---

# Daily Insights Publish Skill

Publish one completed Daily Insights run after `digest` and `card-news` have both succeeded.

## Inputs

- `content/YYYY/MM/DD.md` — generated digest.
- `content/index.json` and `content/inbox.md` — digest index and cleared inbox state.
- `card-news/article-headers/YYYY/MM/DD.json` and `card-news/queries/YYYY/MM/DD.json` — card news sidecars.
- `card-news/output/YYYY/MM/DD/` — rendered article deck JPEGs and credits, used for verification but not committed because this output directory is ignored.
- `public/daily-insights/YYYY/MM/DD/cardnews/` — public JPEG files served by GitHub Pages at `/daily-insights/YYYY/MM/DD/cardnews/A-B`.

## Workflow

1. Resolve `datePath` in `YYYY/MM/DD`; default to today in KST.
2. Confirm `content/<datePath>.md` exists.
3. Confirm card news render outputs exist in `card-news/output/<datePath>/`.
4. Confirm public cardnews assets exist in `public/daily-insights/<datePath>/cardnews/`.
5. Run the repository publish wrapper:
   ```bash
   scripts/automation/run-daily-insights-publish.sh <datePath>
   ```
6. Report the pushed branch and at least one public URL, for example:
   `https://yoonchulyi.com/daily-insights/2026/05/22/cardnews/1-1`

## Notes

- This is the only Daily Insights automation step that should commit and push during `run-daily-flow.sh`.
- Do not regenerate digest text or card news images in this skill.
