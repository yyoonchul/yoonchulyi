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
publish_runner="${SCRIPT_DIR}/run-daily-insights-publish.sh"
local_inbox_path="${REPO_ROOT}/${LOCAL_INBOX_RELATIVE_PATH}"
digest_path="${REPO_ROOT}/${DIGEST_RELATIVE_PATH}"
date_path="$(date +%Y/%m/%d)"

set -a
if [[ -f "${REPO_ROOT}/.env" ]]; then
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.env"
fi
set +a

cardnews_sent_state_dir="${DISCORD_STATE_DIR:-${STATE_ROOT}/discord-cardnews-sent}"
cardnews_sent_state_file="${cardnews_sent_state_dir}/$(echo "${date_path}" | tr '/' '-').ok"
if [[ "${DAILY_FLOW_SKIP_IF_TODAY_COMPLETE:-true}" == "true" \
  && -f "${digest_path}" \
  && -f "${cardnews_sent_state_file}" ]]; then
  print_header "Today's daily flow is already complete. Skip catch-up run."
  run_log_event "Daily flow already complete" \
    "Digest: \`${DIGEST_RELATIVE_PATH}\`"$'\n'"Discord state: \`${cardnews_sent_state_file}\`."
  run_log_finish_success "Today's digest and Discord send state already exist; skipped catch-up run."
  exit 0
fi

[[ -x "${digest_runner}" ]] || {
  echo "ERROR: digest runner is not executable: ${digest_runner}" >&2
  exit 1
}
[[ -x "${cardnews_runner}" ]] || {
  echo "ERROR: card news runner is not executable: ${cardnews_runner}" >&2
  exit 1
}
[[ -x "${publish_runner}" ]] || {
  echo "ERROR: publish runner is not executable: ${publish_runner}" >&2
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
ensure_local_inbox_file
run_log_file_snapshot "Repo inbox before Discord sync" "${local_inbox_path}"

print_header "Syncing Discord inbox"
run_log_event "Syncing Discord inbox" "Running \`scripts/automation/sync-discord-inbox.sh\`."
set +e
"${SCRIPT_DIR}/sync-discord-inbox.sh"
discord_sync_status="$?"
set -e
if [[ "${discord_sync_status}" -ne 0 ]]; then
  run_log_event "Discord inbox sync failed" "Exit status: \`${discord_sync_status}\`."
  if [[ "${DISCORD_INBOX_SYNC_FAIL_FAST:-false}" == "true" ]]; then
    exit "${discord_sync_status}"
  fi
  print_header "Discord inbox sync failed. Continuing with existing local inbox."
else
  run_log_event "Discord inbox sync completed" "Exit status: \`0\`."
fi
run_log_file_snapshot "Repo inbox after Discord sync" "${local_inbox_path}"

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

print_header "Digest and card news complete. Running publish step."
run_log_event "Running publish step" "Digest: \`${DIGEST_RELATIVE_PATH}\`"$'\n'"Card news: \`card-news/output/${date_path}/\`."
"${publish_runner}" "${date_path}"

print_header "Daily flow complete."
run_log_finish_success "Daily flow completed and publish step finished. Digest: \`${DIGEST_RELATIVE_PATH}\`; card news: \`card-news/output/${date_path}/\`."
