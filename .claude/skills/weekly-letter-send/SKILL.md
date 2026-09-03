---
name: weekly-letter-send
description: Send one prepared weekly Daily Insights letter through Resend and record it in the sent-log. Use after the `weekly-letter` skill has written a headline, or when asked to send, resend, or dry-run the weekly letter.
---

# Weekly Letter Send Skill

Send one weekly Daily Insights letter that has already been written.

This skill makes no editorial decisions. It runs the repository's send script,
which renders the letter, hands it to Resend, records the send, and commits the
sent-log. If the letter's subject line or TL;DR do not exist yet, that is the
`weekly-letter` skill's job — run it first.

## Inputs

- `.newsletter-weekly/<monday>/week.json` — the week's collected summaries.
- `.newsletter-weekly/<monday>/headline.json` — the subject line and TL;DR.

Both are produced upstream. If either is missing, stop and say which one, rather
than writing it yourself.

## Workflow

1. Resolve the week's Monday. Default to the most recent directory under
   `.newsletter-weekly/`.
2. Dry-run first, always:
   ```bash
   npx tsx scripts/newsletter/weekly.ts send --week-of <monday> --dry-run
   ```
   This validates `headline.json` and prints both subject lines without sending.
   If it reports a problem, stop and report it — do not edit the headline here.
3. Show the person the subject lines and wait for them to confirm. Email cannot
   be unsent.
4. On confirmation:
   ```bash
   npx tsx scripts/newsletter/weekly.ts send --week-of <monday>
   ```
5. Report what went out per language, including any that reported
   `no-contacts` — that means the segment is empty, so the letter was recorded
   as delivered but nobody received it.

## Notes

- Run the script; never call the Resend API directly and never hand-render the
  letter. The same send path is shared with the essay mailing, which has no
  agent in it at all.
- Do not edit `.newsletter-state.json`. The script writes and commits it, and
  it is what stops a week from going out twice.
- A week already in the sent-log is reported as such and skipped. That is the
  correct outcome, not an error to work around.
- Unattended Monday runs do not use this skill. The Mac pushes the prepared
  week and `.github/workflows/weekly-letter.yml` sends it, so the scheduled path
  needs no Resend key locally. This skill is the by-hand alternative, and it does
  need a real `RESEND_API_KEY` in `.dev.vars`; if there is only the placeholder
  there, say so and point at the workflow's `workflow_dispatch` instead.
