# yoonchulyi.com

Personal website repository for **https://yoonchulyi.com**.

Built with Astro and hosted on `yoonchulyi.com`.

## Project

- About/Experiences page
- Blog (Markdown-based posts)
- Daily Insights (date-based Markdown pages)

## Daily Insights

- Put links into `src/daily-insights/content/inbox.md` (one URL per line, optional memo with `#`).
- The digest workflow collects those links, summarizes them, and writes daily files to `src/daily-insights/content/YYYY/MM/DD.md`.
- It also updates `src/daily-insights/content/index.json` and clears the inbox after processing.
- Output format is split into quick summary and detailed notes for each article.
