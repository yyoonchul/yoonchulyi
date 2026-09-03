#!/usr/bin/env bash
set -euo pipefail

# Prepares the weekly Daily Insights letter and hands it to GitHub Actions.
#
# Only the middle step needs to be here: choosing the lead story and writing the
# TL;DR needs a local agent CLI. Rendering and sending are pure scripts with no
# agent in them, so they stay in Actions next to the essay mailing, where the
# Resend key already lives. This wrapper stops once the week is pushed.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

ENGINE="${1:-codex}"
case "${ENGINE}" in
  codex|claude) ;;
  *)
    echo "ERROR: engine must be 'codex' or 'claude'." >&2
    exit 1
    ;;
esac

acquire_lock "weekly-letter-${ENGINE}"
run_log_init "weekly-letter" "${ENGINE}"
require_command npx
require_command "${ENGINE}"

WEEK_OF="${WEEKLY_LETTER_WEEK_OF:-}"
DRY_RUN="${WEEKLY_LETTER_DRY_RUN:-false}"
PUSH="${WEEKLY_LETTER_PUSH:-true}"
AGENT_TIMEOUT_SECONDS="${WEEKLY_LETTER_AGENT_TIMEOUT_SECONDS:-1800}"
AGENT_RETRY_MAX_ATTEMPTS="${WEEKLY_LETTER_AGENT_RETRY_MAX_ATTEMPTS:-3}"
AGENT_RETRY_INTERVAL_SECONDS="${WEEKLY_LETTER_AGENT_RETRY_INTERVAL_SECONDS:-300}"
CODEX_SANDBOX_MODE="${WEEKLY_LETTER_CODEX_SANDBOX_MODE:-danger-full-access}"
CODEX_BYPASS_APPROVALS_AND_SANDBOX="${WEEKLY_LETTER_CODEX_BYPASS_APPROVALS_AND_SANDBOX:-true}"

if [[ ! "${AGENT_RETRY_MAX_ATTEMPTS}" =~ ^[1-9][0-9]*$ ]]; then
  AGENT_RETRY_MAX_ATTEMPTS="3"
fi
if [[ ! "${AGENT_RETRY_INTERVAL_SECONDS}" =~ ^[0-9]+$ ]]; then
  AGENT_RETRY_INTERVAL_SECONDS="300"
fi

if [[ "${ENGINE}" == "codex" ]]; then
  codex_login_ok || {
    echo "ERROR: Codex is not logged in. Run: codex login" >&2
    exit 1
  }
else
  claude_login_ok || {
    echo "ERROR: Claude Code is not logged in. Run: claude auth login" >&2
    exit 1
  }
fi

# Both phases must agree on which week they are working on, so the override
# rides along here rather than at each call site.
weekly() {
  local command="$1"
  shift
  if [[ -n "${WEEK_OF}" ]]; then
    (cd "${SITE_ROOT}" && npx tsx scripts/newsletter/weekly.ts "${command}" --week-of "${WEEK_OF}" "$@")
  else
    (cd "${SITE_ROOT}" && npx tsx scripts/newsletter/weekly.ts "${command}" "$@")
  fi
}

# --- Phase 1: collect the week ------------------------------------------------

print_header "Planning the weekly letter"
plan_output="$(weekly plan 2>&1 | tee /dev/stderr)"
run_log_event "Weekly letter plan" "$(printf '```\n%s\n```' "${plan_output}")"

plan_value() {
  printf '%s\n' "${plan_output}" | grep -m1 "^$1=" | cut -d= -f2- || true
}

status="$(plan_value STATUS)"
week_start="$(plan_value WEEK_START)"
headline_path="$(plan_value HEADLINE)"
brief_path="$(plan_value BRIEF)"

case "${status}" in
  ready) ;;
  empty)
    print_header "No Daily Insights published in that week. Nothing to send."
    run_log_finish_success "Week \`${week_start}\` had no published insights; skipped."
    exit 0
    ;;
  already-sent)
    print_header "Week ${week_start} has already been sent. Nothing to do."
    run_log_finish_success "Week \`${week_start}\` was already sent; skipped."
    exit 0
    ;;
  *)
    echo "ERROR: unexpected plan status '${status}'." >&2
    exit 1
    ;;
esac

# --- Phase 2: the agent writes the headline -----------------------------------

read -r -d '' PROMPT <<EOF || true
Use the \`weekly-letter\` skill in this repository and run it now for the week
of ${week_start}.

The brief is at \`${brief_path}\`. Write \`${headline_path}\` and nothing else.
Do not run git commands and do not send anything.
EOF

if [[ -s "${headline_path}" ]]; then
  print_header "Headline already exists for ${week_start}. Skipping the agent step."
  run_log_event "Headline reused" "Found existing \`${headline_path}\`; agent step skipped."
else
  attempt=1
  while true; do
    print_header "Writing the headline with ${ENGINE} (attempt ${attempt}/${AGENT_RETRY_MAX_ATTEMPTS})"
    run_log_event "Running weekly-letter skill" "Engine: \`${ENGINE}\`"$'\n'"Attempt: \`${attempt}/${AGENT_RETRY_MAX_ATTEMPTS}\`."

    set +e
    if [[ "${ENGINE}" == "codex" ]]; then
      if [[ "${CODEX_BYPASS_APPROVALS_AND_SANDBOX}" == "true" ]]; then
        run_with_timeout "${AGENT_TIMEOUT_SECONDS}" \
          codex exec \
            -c 'model_reasoning_effort="high"' \
            -C "${SITE_ROOT}" \
            --dangerously-bypass-approvals-and-sandbox \
            "${PROMPT}"
      else
        run_with_timeout "${AGENT_TIMEOUT_SECONDS}" \
          codex exec \
            -c 'model_reasoning_effort="high"' \
            -C "${SITE_ROOT}" \
            -s "${CODEX_SANDBOX_MODE}" \
            "${PROMPT}"
      fi
    else
      (cd "${SITE_ROOT}" && run_with_timeout "${AGENT_TIMEOUT_SECONDS}" \
        claude \
          --print \
          --permission-mode dontAsk \
          --add-dir "${SITE_ROOT}" \
          -p "${PROMPT}")
    fi
    run_status="$?"
    set -e

    # The agent's exit code is not the contract — the file it wrote is. A
    # dry-run re-reads and validates headline.json without sending anything.
    if [[ "${run_status}" -eq 0 ]] && weekly send --dry-run; then
      run_log_event "Headline written" "Attempt: \`${attempt}\`."
      break
    fi

    rm -f "${headline_path}"

    if [[ "${attempt}" -ge "${AGENT_RETRY_MAX_ATTEMPTS}" ]]; then
      run_log_event "Weekly letter skill failed" "Final attempt: \`${attempt}/${AGENT_RETRY_MAX_ATTEMPTS}\`"$'\n'"Exit status: \`${run_status}\`."
      echo "ERROR: no usable headline after ${AGENT_RETRY_MAX_ATTEMPTS} attempts." >&2
      exit 1
    fi

    run_log_event "Weekly letter skill attempt failed" "Attempt: \`${attempt}/${AGENT_RETRY_MAX_ATTEMPTS}\`"$'\n'"Exit status: \`${run_status}\`"$'\n'"Retry in: \`${AGENT_RETRY_INTERVAL_SECONDS}s\`."
    print_header "Headline attempt failed. Retrying in ${AGENT_RETRY_INTERVAL_SECONDS}s."
    if [[ "${AGENT_RETRY_INTERVAL_SECONDS}" -gt 0 ]]; then
      sleep "${AGENT_RETRY_INTERVAL_SECONDS}"
    fi
    attempt="$((attempt + 1))"
  done
fi

run_log_file_snapshot "Headline chosen for ${week_start}" "${headline_path}"

# --- Phase 3: hand the week to the send workflow ------------------------------

if [[ "${DRY_RUN}" == "true" ]]; then
  print_header "Dry run. Reporting what would be handed off."
  weekly send --dry-run
  run_log_finish_success "Dry run for week \`${week_start}\`; nothing committed."
  exit 0
fi

if [[ "${PUSH}" != "true" ]]; then
  print_header "Push disabled. The week is prepared but not handed off."
  run_log_finish_success "Week \`${week_start}\` prepared; push disabled."
  exit 0
fi

# Pushing the workspace is the handoff: `.github/workflows/weekly-letter.yml`
# watches this path and does the sending, where the Resend key already lives.
workspace=".newsletter-weekly/${week_start}"
print_header "Handing ${week_start} to the send workflow"
git -C "${SITE_ROOT}" add "${workspace}"

if git -C "${SITE_ROOT}" diff --cached --quiet -- "${workspace}"; then
  print_header "Workspace unchanged. Nothing to hand off."
  run_log_finish_success "Week \`${week_start}\` was already pushed; nothing to do."
  exit 0
fi

git -C "${SITE_ROOT}" commit -m "chore(newsletter): weekly letter for ${week_start}"
git -C "${SITE_ROOT}" push "${DIGEST_PUSH_REMOTE}" "HEAD:${DIGEST_PUSH_BRANCH}"
run_log_event "Week handed off" "Pushed \`${workspace}\` to \`${DIGEST_PUSH_BRANCH}\`."$'\n'"GitHub Actions sends from here."

run_log_finish_success "Weekly letter for \`${week_start}\` handed off to GitHub Actions."
