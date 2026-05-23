#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

acquire_lock "digest-claude"
run_log_init "digest" "claude"
require_command claude

CLAUDE_TIMEOUT_SECONDS="${DIGEST_CLAUDE_TIMEOUT_SECONDS:-10800}"
CLAUDE_RETRY_MAX_ATTEMPTS="${DIGEST_CLAUDE_RETRY_MAX_ATTEMPTS:-3}"
CLAUDE_RETRY_INTERVAL_SECONDS="${DIGEST_CLAUDE_RETRY_INTERVAL_SECONDS:-600}"
PRE_SYNC_SHORTCUT_NAME="${DIGEST_PRE_SYNC_SHORTCUT_NAME:-}"
PRE_SYNC_DELAY_SECONDS="${DIGEST_PRE_SYNC_DELAY_SECONDS:-0}"
PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS="${DIGEST_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS:-300}"

if [[ ! "${CLAUDE_RETRY_MAX_ATTEMPTS}" =~ ^[1-9][0-9]*$ ]]; then
  CLAUDE_RETRY_MAX_ATTEMPTS="3"
fi
if [[ ! "${CLAUDE_RETRY_INTERVAL_SECONDS}" =~ ^[0-9]+$ ]]; then
  CLAUDE_RETRY_INTERVAL_SECONDS="600"
fi

if ! claude_login_ok; then
  echo "ERROR: Claude Code is not logged in. Run: claude auth login" >&2
  exit 1
fi

if [[ -n "${PRE_SYNC_SHORTCUT_NAME}" ]]; then
  require_command shortcuts

  print_header "Running pre-sync shortcut: ${PRE_SYNC_SHORTCUT_NAME}"
  run_log_event "Running pre-sync shortcut" "Shortcut: \`${PRE_SYNC_SHORTCUT_NAME}\`"$'\n'"Expected action: move links from the iCloud inbox into \`${LOCAL_INBOX_RELATIVE_PATH}\`."
  set +e
  run_with_timeout "${PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS}" \
    shortcuts run "${PRE_SYNC_SHORTCUT_NAME}"
  pre_sync_status="$?"
  set -e

  if [[ "${pre_sync_status}" -eq 124 ]]; then
    run_log_event "Pre-sync shortcut timed out" "Timeout seconds: \`${PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS}\`."
    echo "ERROR: pre-sync shortcut timed out after ${PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS}s." >&2
    exit 124
  fi
  if [[ "${pre_sync_status}" -ne 0 ]]; then
    run_log_event "Pre-sync shortcut failed" "Exit status: \`${pre_sync_status}\`."
    echo "ERROR: pre-sync shortcut failed with exit code ${pre_sync_status}." >&2
    exit "${pre_sync_status}"
  fi
  run_log_event "Pre-sync shortcut completed" "Exit status: \`${pre_sync_status}\`."

  if [[ "${PRE_SYNC_DELAY_SECONDS}" =~ ^[0-9]+$ ]] && [[ "${PRE_SYNC_DELAY_SECONDS}" -gt 0 ]]; then
    print_header "Waiting ${PRE_SYNC_DELAY_SECONDS}s after pre-sync shortcut"
    sleep "${PRE_SYNC_DELAY_SECONDS}"
  fi

  print_header "Pre-sync mode enabled. Skipping direct iCloud sync/clear in this run."
  DIGEST_ICLOUD_AVAILABLE="0"
fi

sync_inbox_from_icloud

read -r -d '' PROMPT <<'EOF' || true
Use the repository skill at `.claude/skills/digest/SKILL.md` and execute it now.

Constraints:
- Read URLs from `content/inbox.md`.
- Write/update `content/YYYY/MM/DD.md` and `content/index.json`.
- Do not clear or modify `content/inbox.md`; the automation script owns inbox clearing.
- If inbox has no valid URLs, respond exactly: `📭 Inbox is empty.`
- Do not run any git commands.
EOF

local_inbox_path="${REPO_ROOT}/${LOCAL_INBOX_RELATIVE_PATH}"
ensure_local_inbox_file
run_log_file_snapshot "Repo inbox content after sync" "${local_inbox_path}"
valid_url_count="$(count_valid_inbox_urls "${local_inbox_path}")"
run_log_event "Repo inbox URL check" "Valid URL lines: \`${valid_url_count}\`."
if [[ "${valid_url_count}" -eq 0 ]]; then
  print_header "Local inbox is empty. Skip digest run."
  run_log_finish_success "No valid URLs found in \`${LOCAL_INBOX_RELATIVE_PATH}\`; skipped digest skill."
  exit 0
fi

attempt=1
while true; do
  print_header "Running digest with Claude Code skill (attempt ${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS})"
  run_log_event "Running digest skill" "Engine: \`claude\`"$'\n'"Attempt: \`${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS}\`."

  set +e
  run_with_timeout "${CLAUDE_TIMEOUT_SECONDS}" \
    claude \
      --print \
      --permission-mode dontAsk \
      --add-dir "${REPO_ROOT}" \
      -p "${PROMPT}"
  run_status="$?"
  set -e

  if [[ "${run_status}" -eq 0 ]]; then
    run_log_event "Digest skill completed" "Attempt: \`${attempt}\`."
    break
  fi

  if [[ "${attempt}" -ge "${CLAUDE_RETRY_MAX_ATTEMPTS}" ]]; then
    run_log_event "Digest skill failed" "Final attempt: \`${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS}\`"$'\n'"Exit status: \`${run_status}\`."
    if [[ "${run_status}" -eq 124 ]]; then
      echo "ERROR: claude run timed out after ${CLAUDE_TIMEOUT_SECONDS}s (attempt ${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS})." >&2
      exit 124
    fi
    echo "ERROR: claude run failed with exit code ${run_status} (attempt ${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS})." >&2
    exit "${run_status}"
  fi

  if [[ "${run_status}" -eq 124 ]]; then
    run_log_event "Digest skill attempt timed out" "Attempt: \`${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS}\`"$'\n'"Retry in: \`${CLAUDE_RETRY_INTERVAL_SECONDS}s\`."
    print_header "Claude run timed out after ${CLAUDE_TIMEOUT_SECONDS}s. Retrying in ${CLAUDE_RETRY_INTERVAL_SECONDS}s."
  else
    run_log_event "Digest skill attempt failed" "Attempt: \`${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS}\`"$'\n'"Exit status: \`${run_status}\`"$'\n'"Retry in: \`${CLAUDE_RETRY_INTERVAL_SECONDS}s\`."
    print_header "Claude run failed with exit code ${run_status}. Retrying in ${CLAUDE_RETRY_INTERVAL_SECONDS}s."
  fi

  if [[ "${CLAUDE_RETRY_INTERVAL_SECONDS}" -gt 0 ]]; then
    sleep "${CLAUDE_RETRY_INTERVAL_SECONDS}"
  fi
  attempt="$((attempt + 1))"
done

print_header "Digest succeeded. Clearing local inbox."
: > "${local_inbox_path}"
run_log_event "Repo inbox cleared by automation" "\`${LOCAL_INBOX_RELATIVE_PATH}\` was cleared after successful digest processing."

run_log_file_snapshot "Repo inbox content after digest skill" "${local_inbox_path}"
if inbox_is_effectively_empty "${local_inbox_path}"; then
  run_log_event "Repo inbox cleared" "\`${LOCAL_INBOX_RELATIVE_PATH}\` is empty after digest processing."
else
  run_log_event "Repo inbox not empty after digest" "\`${LOCAL_INBOX_RELATIVE_PATH}\` still has non-whitespace content after digest processing."
fi

print_header "Digest generation complete. Publish is handled by daily-insights-publish."
run_log_finish_success "Digest automation completed without git commit/push."
