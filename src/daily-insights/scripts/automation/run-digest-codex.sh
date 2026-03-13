#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

acquire_lock "digest-codex"
require_command codex

CODEX_SANDBOX_MODE="${DIGEST_CODEX_SANDBOX_MODE:-danger-full-access}"
CODEX_BYPASS_APPROVALS_AND_SANDBOX="${DIGEST_CODEX_BYPASS_APPROVALS_AND_SANDBOX:-true}"
CODEX_TIMEOUT_SECONDS="${DIGEST_CODEX_TIMEOUT_SECONDS:-10800}"
PRE_SYNC_SHORTCUT_NAME="${DIGEST_PRE_SYNC_SHORTCUT_NAME:-}"
PRE_SYNC_DELAY_SECONDS="${DIGEST_PRE_SYNC_DELAY_SECONDS:-0}"
PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS="${DIGEST_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS:-300}"

if ! codex_login_ok; then
  echo "ERROR: Codex is not logged in. Run: codex login" >&2
  exit 1
fi

if [[ -n "${PRE_SYNC_SHORTCUT_NAME}" ]]; then
  require_command shortcuts

  print_header "Running pre-sync shortcut: ${PRE_SYNC_SHORTCUT_NAME}"
  set +e
  run_with_timeout "${PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS}" \
    shortcuts run "${PRE_SYNC_SHORTCUT_NAME}"
  pre_sync_status="$?"
  set -e

  if [[ "${pre_sync_status}" -eq 124 ]]; then
    echo "ERROR: pre-sync shortcut timed out after ${PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS}s." >&2
    exit 124
  fi
  if [[ "${pre_sync_status}" -ne 0 ]]; then
    echo "ERROR: pre-sync shortcut failed with exit code ${pre_sync_status}." >&2
    exit "${pre_sync_status}"
  fi

  if [[ "${PRE_SYNC_DELAY_SECONDS}" =~ ^[0-9]+$ ]] && [[ "${PRE_SYNC_DELAY_SECONDS}" -gt 0 ]]; then
    print_header "Waiting ${PRE_SYNC_DELAY_SECONDS}s after pre-sync shortcut"
    sleep "${PRE_SYNC_DELAY_SECONDS}"
  fi

  print_header "Pre-sync mode enabled. Skipping direct iCloud sync/clear in this run."
  DIGEST_ICLOUD_AVAILABLE="0"
fi

sync_inbox_from_icloud

read -r -d '' PROMPT <<'EOF' || true
Use the `$digest` skill in this repository and execute the full workflow now.

Constraints:
- Read URLs from `content/inbox.md`.
- Write/update `content/YYYY/MM/DD.md` and `content/index.json`.
- If inbox has no valid URLs, respond exactly: `📭 Inbox is empty.`
- Do not run any git commands.
EOF

local_inbox_path="${REPO_ROOT}/${LOCAL_INBOX_RELATIVE_PATH}"
ensure_local_inbox_file
if [[ ! -s "${local_inbox_path}" ]]; then
  print_header "Local inbox is empty. Skip digest run."
  exit 0
fi

print_header "Running digest with Codex skill"
if [[ "${CODEX_BYPASS_APPROVALS_AND_SANDBOX}" == "true" ]]; then
  print_header "Codex mode: bypass approvals+sandbox (non-interactive)"
  set +e
  run_with_timeout "${CODEX_TIMEOUT_SECONDS}" \
    codex exec \
      -c 'model_reasoning_effort="high"' \
      -C "${REPO_ROOT}" \
      --dangerously-bypass-approvals-and-sandbox \
      "${PROMPT}"
  run_status="$?"
  set -e
else
  print_header "Codex mode: sandbox=${CODEX_SANDBOX_MODE} (non-interactive)"
  set +e
  run_with_timeout "${CODEX_TIMEOUT_SECONDS}" \
    codex exec \
      -c 'model_reasoning_effort="high"' \
      -C "${REPO_ROOT}" \
      -s "${CODEX_SANDBOX_MODE}" \
      "${PROMPT}"
  run_status="$?"
  set -e
fi

if [[ "${run_status}" -eq 124 ]]; then
  echo "ERROR: codex run timed out after ${CODEX_TIMEOUT_SECONDS}s." >&2
  exit 124
fi
if [[ "${run_status}" -ne 0 ]]; then
  echo "ERROR: codex run failed with exit code ${run_status}." >&2
  exit "${run_status}"
fi

clear_icloud_inbox_if_local_cleared

run_git_commit_and_push
