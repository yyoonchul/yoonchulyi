#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
LOCAL_INBOX_RELATIVE_PATH="${DIGEST_LOCAL_INBOX_RELATIVE_PATH:-content/inbox.md}"
LOCAL_INBOX_PATH="${REPO_ROOT}/${LOCAL_INBOX_RELATIVE_PATH}"
RUN_DIGEST_AFTER_SYNC="${SHORTCUT_RUN_DIGEST_AFTER_SYNC:-false}"

# Shortcut "Get Contents of File" text is passed via stdin.
INPUT_CONTENT="$(cat)"
INPUT_CONTENT="${INPUT_CONTENT//$'\r'/}"

if [[ -z "${INPUT_CONTENT//[[:space:]]/}" ]]; then
  mkdir -p "$(dirname "${LOCAL_INBOX_PATH}")"
  : > "${LOCAL_INBOX_PATH}"
  echo "EMPTY"
  exit 0
fi

mkdir -p "$(dirname "${LOCAL_INBOX_PATH}")"
TMP_INBOX_PATH="$(mktemp "${LOCAL_INBOX_PATH}.tmp.XXXXXX")"
printf "%s\n" "${INPUT_CONTENT}" > "${TMP_INBOX_PATH}"
mv "${TMP_INBOX_PATH}" "${LOCAL_INBOX_PATH}"

if [[ "${RUN_DIGEST_AFTER_SYNC}" != "true" ]]; then
  echo "SYNC_OK"
  exit 0
fi

cd "${REPO_ROOT}"

# Full mode: run digest after sync. Disable pre-sync shortcut recursion and direct iCloud access.
DUMMY_ICLOUD_PATH="${REPO_ROOT}/.digest-disabled-icloud-inbox-do-not-create"
DIGEST_PRE_SYNC_SHORTCUT_NAME="" \
DIGEST_ICLOUD_INBOX_PATH="${DUMMY_ICLOUD_PATH}" \
./scripts/automation/run-digest-codex.sh 1>&2

if [[ -s "${LOCAL_INBOX_PATH}" ]]; then
  echo "FAIL_LOCAL_INBOX_NOT_CLEARED"
  exit 1
fi

echo "OK"
