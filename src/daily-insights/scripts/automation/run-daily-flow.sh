#!/usr/bin/env bash
set -euo pipefail

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

acquire_lock "daily-flow-${ENGINE}"
run_log_init "daily-flow" "${ENGINE}"

digest_runner="${SCRIPT_DIR}/run-digest-${ENGINE}.sh"
cardnews_runner="${SCRIPT_DIR}/run-cardnews-${ENGINE}.sh"
local_inbox_path="${REPO_ROOT}/${LOCAL_INBOX_RELATIVE_PATH}"
digest_path="${REPO_ROOT}/${DIGEST_RELATIVE_PATH}"
date_path="$(date +%Y/%m/%d)"
PRE_SYNC_SHORTCUT_NAME="${DIGEST_PRE_SYNC_SHORTCUT_NAME:-}"
PRE_SYNC_DELAY_SECONDS="${DIGEST_PRE_SYNC_DELAY_SECONDS:-0}"
PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS="${DIGEST_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS:-300}"

[[ -x "${digest_runner}" ]] || {
  echo "ERROR: digest runner is not executable: ${digest_runner}" >&2
  exit 1
}
[[ -x "${cardnews_runner}" ]] || {
  echo "ERROR: card news runner is not executable: ${cardnews_runner}" >&2
  exit 1
}

file_hash_or_missing() {
  local file_path="$1"
  if [[ ! -f "${file_path}" ]]; then
    printf '__missing__\n'
    return 0
  fi
  shasum -a 256 "${file_path}" | awk '{ print $1 }'
}

restore_local_inbox() {
  local backup_path="$1"
  if [[ -f "${backup_path}" ]]; then
    cp "${backup_path}" "${local_inbox_path}"
    run_log_file_snapshot "Repo inbox restored after digest failure" "${local_inbox_path}"
  fi
}

print_header "Preparing inbox for daily flow"
run_log_event "Daily flow started" "Engine: \`${ENGINE}\`"$'\n'"Date path: \`${date_path}\`."
pre_sync_existing_inbox_path=""
if [[ -n "${PRE_SYNC_SHORTCUT_NAME}" ]]; then
  require_command shortcuts
  ensure_local_inbox_file

  if [[ "$(count_valid_inbox_urls "${local_inbox_path}")" -gt 0 ]]; then
    pre_sync_existing_inbox_path="$(mktemp "${local_inbox_path}.pre-sync.XXXXXX")"
    cp "${local_inbox_path}" "${pre_sync_existing_inbox_path}"
  fi

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

DIGEST_FAIL_ON_ICLOUD_CLEAR_ERROR=true
sync_inbox_from_icloud
ensure_local_inbox_file
if [[ -n "${pre_sync_existing_inbox_path}" && -f "${pre_sync_existing_inbox_path}" ]]; then
  tmp_merged_inbox_path="$(mktemp "${local_inbox_path}.merged.XXXXXX")"
  awk 'seen[$0]++ == 0' "${pre_sync_existing_inbox_path}" "${local_inbox_path}" > "${tmp_merged_inbox_path}"
  mv "${tmp_merged_inbox_path}" "${local_inbox_path}"
  rm -f "${pre_sync_existing_inbox_path}"
  run_log_event "Repo inbox preserved across pre-sync" "Existing local inbox URLs were merged back after shortcut pre-sync."
fi
run_log_file_snapshot "Repo inbox after iCloud move" "${local_inbox_path}"

inbox_backup_path="$(mktemp "${local_inbox_path}.daily-flow.XXXXXX")"
cp "${local_inbox_path}" "${inbox_backup_path}"
digest_hash_before="$(file_hash_or_missing "${digest_path}")"

valid_url_count="$(count_valid_inbox_urls "${local_inbox_path}")"
run_log_event "Repo inbox URL check" "Valid URL lines: \`${valid_url_count}\`."
if [[ "${valid_url_count}" -eq 0 ]]; then
  print_header "Local inbox is empty. Skip digest and card news."
  rm -f "${inbox_backup_path}"
  run_log_finish_success "No valid URLs found in \`${LOCAL_INBOX_RELATIVE_PATH}\`; skipped digest and card news."
  exit 0
fi

print_header "Running digest step"
set +e
DIGEST_SKIP_INBOX_SYNC=true \
DIGEST_PRE_SYNC_SHORTCUT_NAME="" \
DIGEST_SKIP_GIT_COMMIT_AND_PUSH=true \
  "${digest_runner}"
digest_status="$?"
set -e

if [[ "${digest_status}" -ne 0 ]]; then
  print_header "Digest failed. Restoring local inbox and stopping daily flow."
  run_log_event "Digest step failed" "Exit status: \`${digest_status}\`."$'\n'"Card news will not run."
  restore_local_inbox "${inbox_backup_path}"
  rm -f "${inbox_backup_path}"
  exit "${digest_status}"
fi

digest_hash_after="$(file_hash_or_missing "${digest_path}")"
if [[ "${digest_hash_after}" == "__missing__" ]]; then
  print_header "Digest step completed but today's digest is missing. Restoring local inbox."
  run_log_event "Digest output missing" "Expected path: \`${DIGEST_RELATIVE_PATH}\`."$'\n'"Card news will not run."
  restore_local_inbox "${inbox_backup_path}"
  rm -f "${inbox_backup_path}"
  exit 1
fi

if [[ "${digest_hash_before}" == "${digest_hash_after}" ]]; then
  print_header "Today's digest did not change. Restoring local inbox and stopping daily flow."
  run_log_event "Digest unchanged" "Path: \`${DIGEST_RELATIVE_PATH}\`."$'\n'"Card news will not run because today's digest was not freshly generated or updated."
  restore_local_inbox "${inbox_backup_path}"
  rm -f "${inbox_backup_path}"
  exit 1
fi

rm -f "${inbox_backup_path}"

print_header "Digest changed successfully. Committing digest changes."
run_log_event "Committing digest step" "Digest: \`${DIGEST_RELATIVE_PATH}\`."
run_git_commit_and_push

print_header "Digest changed successfully. Running card news step."
run_log_event "Running card news step" "Digest: \`${DIGEST_RELATIVE_PATH}\`."
set +e
"${cardnews_runner}"
cardnews_status="$?"
set -e

if [[ "${cardnews_status}" -ne 0 ]]; then
  run_log_event "Card news step failed" "Exit status: \`${cardnews_status}\`."
  exit "${cardnews_status}"
fi

print_header "Daily flow complete."
run_log_finish_success "Daily flow completed. Digest: \`${DIGEST_RELATIVE_PATH}\`; card news: \`card-news/output/${date_path}/\`."
