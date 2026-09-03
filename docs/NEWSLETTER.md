# Newsletter

Two mailings, two schedules, one sent-log.

| Mailing | Trigger | Runner | Topic |
| --- | --- | --- | --- |
| Essays | after a successful deploy, one email per new post | GitHub Actions (`.github/workflows/newsletter.yml`) | `RESEND_TOPIC_ESSAYS` |
| Daily Insights letter | Monday morning, covering the week that just closed | launchd on the Mac (`run-weekly-letter-{codex,claude}.sh`) | `RESEND_TOPIC_DAILY` |

Each mailing goes out twice, once per language segment (`RESEND_SEGMENT_EN`,
`RESEND_SEGMENT_KO`).

## Sent-log

Both mailings read and write `.newsletter-state.json`, committed to the repo so
the history is reviewable in git and a rerun is a no-op. Keys are
`<post guid>|<language>` for essays and `weekly:<monday>|<language>` for the
weekly letter.

`tsx scripts/newsletter/send.ts --seed` records everything currently in the
feeds as already sent without emailing — the way to skip a backlog.

## The weekly letter

It runs in two deterministic phases with one agent step between them. The agent
writes the subject line and three TL;DR lines. Nothing else.

```
plan   collect the week's published summaries → .newsletter-weekly/<monday>/
  ↓    agent reads brief.md, writes headline.json (weekly-letter skill)
send   render both letters from that and hand them to Resend
```

**plan** (`weekly.ts plan`) resolves the window — the seven days ending on the
Sunday before the most recent Monday — and for each day reads
`src/daily-insights/content/YYYY/MM/DD.md`, lifting the "Quick Summary" /
"간단 요약" section: per-article title, source line, and the three bullets.
Nothing is rewritten, and the detailed notes stay on the site. Entries whose
only bullet is a ⚠️ fetch-failure marker are dropped. The RSS feed is fetched
too, but only to confirm each day is live before it is linked; a day that has
not deployed yet is skipped rather than linked to a 404.

It writes `week.json` (the payload `send` renders from) and `brief.md` (what the
agent reads), then prints `STATUS=ready|empty|already-sent` for the wrapper.

**The agent step** is the `weekly-letter` skill, registered for both engines
under `.claude/skills/` and `.codex/skills/`. It reads `brief.md`, picks the
week's most consequential story, and writes `headline.json`. It never touches
Resend, the sent-log, the letter template, or git.

Sending has its own thin skill, `weekly-letter-send`, which makes no editorial
decisions and only runs the send script — the same split as `digest` followed by
`daily-insights-publish`. Judgment lives in one skill, the irreversible step in
the other, and the mechanics of both live in scripts. Unattended Monday runs
skip the second skill and call the script directly, the way `run-daily-flow.sh`
calls `run-daily-insights-publish.sh`.

**send** (`weekly.ts send`, shared with the essay mailing through
`shared.ts`) validates `headline.json` field by field — both
subjects present and under 120 characters, exactly three non-empty TL;DR lines
per language — and refuses to send otherwise. The wrapper treats the validation,
not the agent's exit code, as the contract: a run that exits 0 with an unusable
headline is retried.

```sh
tsx scripts/newsletter/weekly.ts plan                       # prepare a week
tsx scripts/newsletter/weekly.ts plan --week-of 2026-08-31  # pick one explicitly
tsx scripts/newsletter/weekly.ts send --preview             # write both letters to .newsletter-preview/
tsx scripts/newsletter/weekly.ts send --dry-run             # validate and print both subjects
```

`--preview` falls back to placeholder copy when no headline exists yet, so the
layout can be checked before any agent has run.

### Scheduling

```sh
src/daily-insights/scripts/automation/weekly-letter-launchd.sh setup codex 08:30
src/daily-insights/scripts/automation/weekly-letter-launchd.sh status all
src/daily-insights/scripts/automation/weekly-letter-launchd.sh run-now codex
```

`setup <engine> [HH:MM] [WEEKDAY]` defaults to Monday (weekday 1) at 08:30 in
`Asia/Seoul`. Use `claude` in place of `codex` to run the same flow through
Claude Code.

Useful overrides when running the wrapper by hand:

| Variable | Default | Effect |
| --- | --- | --- |
| `WEEKLY_LETTER_DRY_RUN` | `false` | Stop after validating; send nothing |
| `WEEKLY_LETTER_WEEK_OF` | last week | Monday of the week to build |
| `WEEKLY_LETTER_PUSH_STATE` | `true` | Commit and push `.newsletter-state.json` after sending |
| `WEEKLY_LETTER_AGENT_RETRY_MAX_ATTEMPTS` | `3` | Retries before giving up on a usable headline |

An existing `headline.json` is reused rather than regenerated, so a run that
failed at the send step can be retried without spending another agent run — and
so a headline you wrote or edited by hand is honoured.

## Empty audiences

Resend answers a send with `422 … has no contacts` when the segment is empty.
That is not a failure — there is simply nobody to mail — so `shared.ts` logs it,
records the send as delivered, deletes the unsent draft, and moves on. Treating
it as an error previously aborted the run before later languages were attempted
and left nothing recorded, so the same backlog was retried and failed nightly.

## Credentials

The essay workflow reads them from GitHub Actions: secret `RESEND_API_KEY`,
variables `RESEND_SEGMENT_EN`, `RESEND_SEGMENT_KO`, `RESEND_TOPIC_ESSAYS`.

The weekly letter runs on the Mac and reads the same names out of `.dev.vars`,
the site's existing gitignored local secrets file. The four list IDs are already
there, copied from the repository's GitHub Actions variables — they identify
lists, not credentials, and the repository is public, so they stay out of source
but need no protecting beyond that.

Only `RESEND_API_KEY` is a real secret, and GitHub secrets cannot be read back,
so that one value has to be pasted into `.dev.vars` once. The wrapper checks all
four names are set *and* that the key starts with `re_` before it starts, so a
placeholder fails immediately instead of after an agent run.

Only `RESEND_*` names are read out of that file. The same file holds the admin
and subscribe secrets, and the agent runs as a child of the wrapper; nothing it
does not need belongs in its environment.
