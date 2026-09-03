---
name: weekly-letter
description: Choose the lead story and write the TL;DR for the weekly Daily Insights email. Use after `weekly.ts plan` has prepared a week under `.newsletter-weekly/`, or when asked to write the weekly letter's subject line and three-line summary.
---

# Weekly Letter Skill

Write the top of one weekly Daily Insights email: the subject line and the
three-line TL;DR, in English and Korean.

That is the whole job. The letter's body is assembled verbatim from summaries
already published on the site, and the deterministic scripts decide which days
are in scope, which are live, what the markup looks like, who receives it, and
what has already gone out. Your only output is one small JSON file.

## Inputs

- `.newsletter-weekly/<monday>/brief.md` — the week's published summaries, both
  languages. Written by `scripts/newsletter/weekly.ts plan`.

If no directory is named, use the most recent one under `.newsletter-weekly/`.
If none exists, run `npx tsx scripts/newsletter/weekly.ts plan` first; a
`STATUS=empty` or `STATUS=already-sent` line means there is nothing to write and
you should stop and say so.

## Output

`.newsletter-weekly/<monday>/headline.json`, exactly this shape:

```json
{
  "lead": "English title of the chosen story, copied exactly from the brief",
  "subject": { "en": "...", "ko": "..." },
  "tldr": { "en": ["...", "...", "..."], "ko": ["...", "...", "..."] }
}
```

Write nothing else. Do not edit `brief.md`, `week.json`, the letter template,
`.newsletter-state.json`, or anything under `scripts/`. Do not run git commands
or send anything — the automation script owns sending.

## Choosing the lead

Pick the single most consequential story of the week — the one a reader would
most regret missing. Weigh how much it changes what a builder or founder should
do next, not how loud it was. `lead` is that story's English title, copied from
the brief so the run log can be checked against it.

## Subject line

- Names the lead story as a headline a reader can act on. Not a topic label, not
  a date, not a count of items.
- Under 60 characters where the story allows it; never over 120.
- No newsletter name, no week range, no "This week:" prefix — the template
  already carries a kicker and the date range.

## TL;DR

- Exactly three lines. The first covers the lead story; the other two cover the
  next two most important threads of the week. Three different stories, never a
  restatement of the same one.
- Each line is one sentence that stands alone and names the specific thing that
  happened — what shipped, who acquired what, what the number was.
- No throat-clearing ("This week's issue covers…", "In other news…").

## Language

Write English and Korean as native copy in each language, not as translations of
each other.

- Korean uses the plain declarative `-다` form, matching the summaries printed
  below it in the same email. Do not use `-습니다`/`-ㅂ니다`.
- Company, organisation, product, and model names stay in English, spelled the
  way the summaries below spell them. The TL;DR sits directly above those
  bullets in the same screen, so `앤트로픽` over `Anthropic`, or `엔비디아` over
  `Nvidia`, reads as two people wrote the email. Do not transliterate a name the
  body leaves in English.
- Keep established English technical terms in English rather than forcing a
  translation; add the original in parentheses where it helps.
- Refer to people by name or public handle, not by gendered pronouns
  (`그`, `그녀`, `he`, `she`).

## Verify before reporting

```bash
npx tsx scripts/newsletter/weekly.ts send --week-of <monday> --dry-run
```

This re-reads and validates `headline.json` and prints both subject lines
without sending. Fix and rerun if it reports a problem.

Then report the lead story you chose and both subject lines.

## Notes

- This skill writes; it does not send. Sending is `weekly-letter-send`, the way
  `digest` is followed by `daily-insights-publish`.
- The letter's body never passes through you. It is assembled from `week.json`
  and rendered by `scripts/newsletter/email.ts`, so a summary cannot be
  reworded, reordered, or dropped on the way to an inbox.
