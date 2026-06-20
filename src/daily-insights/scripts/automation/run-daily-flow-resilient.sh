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

WINDOW_START_HOUR="${DAILY_FLOW_RESILIENT_START_HOUR:-22}"
WINDOW_END_HOUR="${DAILY_FLOW_RESILIENT_END_HOUR:-2}"

if [[ ! "${WINDOW_START_HOUR}" =~ ^([01]?[0-9]|2[0-3])$ ]]; then
  echo "ERROR: DAILY_FLOW_RESILIENT_START_HOUR must be 0-23." >&2
  exit 1
fi
if [[ ! "${WINDOW_END_HOUR}" =~ ^([01]?[0-9]|2[0-3])$ ]]; then
  echo "ERROR: DAILY_FLOW_RESILIENT_END_HOUR must be 0-23." >&2
  exit 1
fi

WINDOW_START_HOUR="$((10#${WINDOW_START_HOUR}))"
WINDOW_END_HOUR="$((10#${WINDOW_END_HOUR}))"

acquire_lock "daily-flow-resilient-${ENGINE}"
run_log_init "daily-flow-resilient" "${ENGINE}"

set -a
if [[ -f "${REPO_ROOT}/.env" ]]; then
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.env"
fi
set +a

current_hour="$((10#$(date +%H)))"
local_inbox_path="${REPO_ROOT}/${LOCAL_INBOX_RELATIVE_PATH}"
flow_runner="${SCRIPT_DIR}/run-daily-flow-${ENGINE}.sh"
state_dir="${STATE_ROOT}/daily-flow-resilient"

within_window() {
  if [[ "${WINDOW_START_HOUR}" -eq "${WINDOW_END_HOUR}" ]]; then
    return 0
  fi

  if [[ "${WINDOW_START_HOUR}" -lt "${WINDOW_END_HOUR}" ]]; then
    [[ "${current_hour}" -ge "${WINDOW_START_HOUR}" && "${current_hour}" -lt "${WINDOW_END_HOUR}" ]]
    return $?
  fi

  [[ "${current_hour}" -ge "${WINDOW_START_HOUR}" || "${current_hour}" -lt "${WINDOW_END_HOUR}" ]]
}

window_id() {
  if [[ "${WINDOW_START_HOUR}" -gt "${WINDOW_END_HOUR}" && "${current_hour}" -lt "${WINDOW_END_HOUR}" ]]; then
    date -v-1d +%F
  else
    date +%F
  fi
}

mkdir -p "${state_dir}"
if command -v find >/dev/null 2>&1; then
  find "${state_dir}" -type f -name '*.success' -mtime +14 -delete 2>/dev/null || true
fi

if ! within_window; then
  run_log_finish_success "Outside resilient window (${WINDOW_START_HOUR}:00-${WINDOW_END_HOUR}:00). Nothing to do."
  exit 0
fi

run_window_id="$(window_id)"
success_marker="${state_dir}/${ENGINE}-${run_window_id}.success"

if [[ -f "${success_marker}" ]]; then
  run_log_finish_success "Daily flow already succeeded for window ${run_window_id}; skipping until the next 22:00 window."
  exit 0
fi

ensure_local_inbox_file
run_log_file_snapshot "Repo inbox before resilient Discord sync" "${local_inbox_path}"

print_header "Resilient window is active. Syncing Discord inbox."
run_log_event "Syncing Discord inbox" "Window: \`${run_window_id}\`"$'\n'"Running \`scripts/automation/sync-discord-inbox.sh\`."
set +e
"${SCRIPT_DIR}/sync-discord-inbox.sh"
discord_sync_status="$?"
set -e
if [[ "${discord_sync_status}" -ne 0 ]]; then
  run_log_event "Discord inbox sync failed" "Exit status: \`${discord_sync_status}\`."
  if [[ "${DISCORD_INBOX_SYNC_FAIL_FAST:-false}" == "true" ]]; then
    exit "${discord_sync_status}"
  fi
else
  run_log_event "Discord inbox sync completed" "Exit status: \`0\`."
fi

run_log_file_snapshot "Repo inbox after resilient Discord sync" "${local_inbox_path}"
valid_url_count="$(count_valid_inbox_urls "${local_inbox_path}")"
run_log_event "Repo inbox URL check" "Valid URL lines: \`${valid_url_count}\`."

if [[ "${valid_url_count}" -eq 0 ]]; then
  run_log_finish_success "No valid URLs found. Will check again on the next launchd interval."
  exit 0
fi

[[ -x "${flow_runner}" ]] || {
  echo "ERROR: daily flow runner is not executable: ${flow_runner}" >&2
  exit 1
}

print_header "Inbox has URLs. Running full daily flow under caffeinate."
run_log_event "Running full daily flow" "Runner: \`${flow_runner}\`"$'\n'"Window: \`${run_window_id}\`."
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -dimsu "${flow_runner}"
else
  run_log_event "caffeinate not found" "Running full daily flow without sleep prevention."
  "${flow_runner}"
fi

{
  printf 'window=%s\n' "${run_window_id}"
  printf 'engine=%s\n' "${ENGINE}"
  printf 'completed_at=%s\n' "$(date '+%F %T %Z')"
} > "${success_marker}"

run_log_finish_success "Full daily flow completed. Wrote success marker: \`${success_marker}\`."
