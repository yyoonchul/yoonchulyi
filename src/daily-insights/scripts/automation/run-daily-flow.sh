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

publish_runner="${SCRIPT_DIR}/run-daily-insights-publish.sh"
local_inbox_path="${REPO_ROOT}/${LOCAL_INBOX_RELATIVE_PATH}"
date_path="$(date +%Y/%m/%d)"

set -a
if [[ -f "${REPO_ROOT}/.env" ]]; then
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.env"
fi
set +a

[[ -x "${publish_runner}" ]] || {
  echo "ERROR: publish runner is not executable: ${publish_runner}" >&2
  exit 1
}

# A previous run may have generated a digest but failed to push it. Publish
# that saved result before accepting new inbox items.
"${publish_runner}" --retry-pending

file_hash_or_missing() {
  local file_path="$1"
  if [[ ! -f "${file_path}" ]]; then
    printf '__missing__\n'
    return 0
  fi
  shasum -a 256 "${file_path}" | awk '{ print $1 }'
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

valid_url_count="$(count_valid_inbox_urls "${local_inbox_path}")"
run_log_event "Repo inbox URL check" "Valid URL lines: \`${valid_url_count}\`."
if [[ "${valid_url_count}" -eq 0 ]]; then
  print_header "Local inbox is empty. Skip digest."
  run_log_finish_success "No valid URLs found in \`${LOCAL_INBOX_RELATIVE_PATH}\`; skipped digest."
  exit 0
fi

generation_worktree="$(mktemp -d "${STATE_ROOT}/digest-worktree.XXXXXX")"
rmdir "${generation_worktree}"
git -C "${SITE_ROOT}" worktree add --detach "${generation_worktree}" HEAD
ACTIVE_WORKTREE_PATH="${generation_worktree}"
generation_root="${generation_worktree}/src/daily-insights"
generation_inbox="${generation_root}/${LOCAL_INBOX_RELATIVE_PATH}"
processed_inbox_snapshot="${generation_worktree}/.processed-inbox"
digest_path="${generation_root}/${DIGEST_RELATIVE_PATH}"
digest_runner="${generation_root}/scripts/automation/run-digest-${ENGINE}.sh"
[[ -x "${digest_runner}" ]] || {
  echo "ERROR: digest runner is not executable: ${digest_runner}" >&2
  exit 1
}
cp "${local_inbox_path}" "${generation_inbox}"
cp "${generation_inbox}" "${processed_inbox_snapshot}"
digest_hash_before="$(file_hash_or_missing "${digest_path}")"

print_header "Running digest step"
set +e
DIGEST_SKIP_INBOX_SYNC=true \
DIGEST_PRE_SYNC_SHORTCUT_NAME="" \
DIGEST_RUN_LOG_ROOT="${RUN_LOG_ROOT}" \
  "${digest_runner}"
digest_status="$?"
set -e

if [[ "${digest_status}" -ne 0 ]]; then
  print_header "Digest failed. Local inbox remains available for the next run."
  run_log_event "Digest step failed" "Exit status: \`${digest_status}\`."
  exit "${digest_status}"
fi

digest_hash_after="$(file_hash_or_missing "${digest_path}")"
if [[ "${digest_hash_after}" == "__missing__" ]]; then
  print_header "Digest step completed but today's digest is missing."
  run_log_event "Digest output missing" "Expected path: \`${DIGEST_RELATIVE_PATH}\`."
  exit 1
fi

if [[ "${digest_hash_before}" == "${digest_hash_after}" ]]; then
  print_header "Today's digest did not change. Stopping daily flow."
  run_log_event "Digest unchanged" "Path: \`${DIGEST_RELATIVE_PATH}\`."$'\n'"Digest was not freshly generated or updated."
  exit 1
fi

print_header "Digest changed successfully. Saving it for publication."
DAILY_INSIGHTS_PUBLISH_SOURCE_ROOT="${generation_root}" \
  "${publish_runner}" --queue-only "${date_path}"

# The saved digest is durable now. New Discord links arriving later remain in
# the inbox because only the lines from this run are removed.
python3 - "${local_inbox_path}" "${processed_inbox_snapshot}" <<'PY'
import sys
from collections import Counter
from pathlib import Path
from tempfile import NamedTemporaryFile
import os

inbox_path, processed_path = sys.argv[1:]
with open(inbox_path, encoding="utf-8") as inbox_file:
    current = inbox_file.readlines()
with open(processed_path, encoding="utf-8") as processed_file:
    processed = Counter(processed_file.readlines())
remaining = []
for line in current:
    if processed[line]:
        processed[line] -= 1
    else:
        remaining.append(line)
inbox = Path(inbox_path)
with NamedTemporaryFile("w", encoding="utf-8", dir=inbox.parent, delete=False) as temp_file:
    temp_file.writelines(remaining)
    temp_path = temp_file.name
os.chmod(temp_path, inbox.stat().st_mode & 0o777)
os.replace(temp_path, inbox_path)
PY

git -C "${SITE_ROOT}" worktree remove --force "${generation_worktree}"
ACTIVE_WORKTREE_PATH=""

print_header "Running publish step."
run_log_event "Running publish step" "Digest: \`${DIGEST_RELATIVE_PATH}\`."
"${publish_runner}" --retry-pending

print_header "Daily flow complete."
run_log_finish_success "Daily flow completed and publish step finished. Digest: \`${DIGEST_RELATIVE_PATH}\`."
