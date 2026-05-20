# yoonchulyi.com Agent Guide

This repository is an Astro personal site for Yoonchul Yi. Keep this file as a
map for agents; detailed operating knowledge belongs in `docs/`.

## Project Shape

- `src/pages/` contains Astro routes.
- `src/blog/` contains blog content, collection setup, rendering, and helpers.
- `src/daily-insights/` contains Daily Insights content, rendering, and
  automation-related code.
- `src/about/` contains About page content and rendering.
- `src/components/` and `src/layouts/` contain shared page structure.
- `src/lib/seo.ts` and `src/lib/schema.ts` contain the SEO/GEO backbone.

## Commands

- `npm run build` builds the static site.
- `npm run dev` starts the Astro dev server.

## SEO/GEO Rules

Before adding pages, changing metadata behavior, or adding blog/Daily Insights
content, read [docs/SEO_GEO.md](docs/SEO_GEO.md).

Key reminders:

- Do not rewrite existing content unless the task explicitly asks for content
  changes.
- New blog posts should use the expanded SEO frontmatter documented in
  `docs/SEO_GEO.md`.
- Keep canonical URLs, sitemap inclusion, robots policy, and structured data in
  sync with the shared helpers.
- The site targets both English and Korean discovery; preserve that assumption
  when changing language or routing behavior.
