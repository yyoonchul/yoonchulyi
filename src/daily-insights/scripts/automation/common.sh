#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

export TZ="${DIGEST_TIMEZONE:-Asia/Seoul}"

LOG_ROOT="${DIGEST_LOG_ROOT:-${HOME}/Library/Logs/daily-insights}"
STATE_ROOT="${DIGEST_STATE_ROOT:-${HOME}/Library/Application Support/daily-insights}"

mkdir -p "${LOG_ROOT}" "${STATE_ROOT}"

DIGEST_DATE="$(date +%F)"
DIGEST_RELATIVE_PATH="content/$(date +%Y/%m/%d).md"
DIGEST_PUSH_REMOTE="${DIGEST_PUSH_REMOTE:-origin}"
LOCAL_INBOX_RELATIVE_PATH="${DIGEST_LOCAL_INBOX_RELATIVE_PATH:-content/inbox.md}"
DIGEST_LOCK_MAX_AGE_SECONDS="${DIGEST_LOCK_MAX_AGE_SECONDS:-43200}"
DIGEST_LOCK_KILL_GRACE_SECONDS="${DIGEST_LOCK_KILL_GRACE_SECONDS:-15}"
DIGEST_DISABLE_ICLOUD_ON_PERMISSION_ERROR="${DIGEST_DISABLE_ICLOUD_ON_PERMISSION_ERROR:-true}"
DIGEST_ICLOUD_AVAILABLE="1"
ICLOUD_INBOX_PATH_DEFAULT="${HOME}/Library/Mobile Documents/com~apple~CloudDocs/Shortcuts/daily-insights/inbox.md"
ICLOUD_INBOX_PATH_WORKFLOW="${HOME}/Library/Mobile Documents/iCloud~is~workflow~my~workflows/Documents/daily-insights/inbox.md"
# Prefer explicit override, then the Shortcuts "My Workflows" container path
# used on this machine, then the iCloud Drive/Shortcuts path.
if [[ -n "${DIGEST_ICLOUD_INBOX_PATH:-}" ]]; then
  DIGEST_ICLOUD_INBOX_PATH="${DIGEST_ICLOUD_INBOX_PATH}"
elif [[ -f "${ICLOUD_INBOX_PATH_WORKFLOW}" ]]; then
  DIGEST_ICLOUD_INBOX_PATH="${ICLOUD_INBOX_PATH_WORKFLOW}"
else
  DIGEST_ICLOUD_INBOX_PATH="${ICLOUD_INBOX_PATH_DEFAULT}"
fi

DEFAULT_BRANCH="$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ -z "${DEFAULT_BRANCH}" || "${DEFAULT_BRANCH}" == "HEAD" ]]; then
  DEFAULT_BRANCH="main"
fi
DIGEST_PUSH_BRANCH="${DIGEST_PUSH_BRANCH:-${DEFAULT_BRANCH}}"

print_header() {
  local message="$1"
  printf "\n[%s] %s\n" "$(date '+%F %T %Z')" "${message}"
}

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "ERROR: '${command_name}' command not found in PATH." >&2
    exit 1
  fi
}

codex_login_ok() {
  codex -c 'model_reasoning_effort="high"' login status >/dev/null 2>&1
}

claude_login_ok() {
  local status
  status="$(claude auth status 2>/dev/null || true)"
  echo "${status}" | grep -Eq '"loggedIn"[[:space:]]*:[[:space:]]*true'
}

release_lock() {
  local lock_path="$1"
  rm -f "${lock_path}/pid" "${lock_path}/started_at" >/dev/null 2>&1 || true
  rmdir "${lock_path}" >/dev/null 2>&1 || true
}

acquire_lock() {
  local lock_name="$1"
  local lock_dir="${STATE_ROOT}/locks"
  local lock_path="${lock_dir}/${lock_name}.lock"
  local existing_pid=""
  local existing_started_at=""
  local now age

  if [[ ! "${DIGEST_LOCK_MAX_AGE_SECONDS}" =~ ^[0-9]+$ ]]; then
    DIGEST_LOCK_MAX_AGE_SECONDS=43200
  fi
  if [[ ! "${DIGEST_LOCK_KILL_GRACE_SECONDS}" =~ ^[0-9]+$ ]]; then
    DIGEST_LOCK_KILL_GRACE_SECONDS=15
  fi

  mkdir -p "${lock_dir}"
  if mkdir "${lock_path}" 2>/dev/null; then
    printf '%s\n' "$$" > "${lock_path}/pid"
    date +%s > "${lock_path}/started_at"
    trap 'release_lock "'"${lock_path}"'"' EXIT
    return 0
  fi

  if [[ -f "${lock_path}/pid" ]]; then
    existing_pid="$(cat "${lock_path}/pid" 2>/dev/null || true)"
  fi
  if [[ -f "${lock_path}/started_at" ]]; then
    existing_started_at="$(cat "${lock_path}/started_at" 2>/dev/null || true)"
  fi

  now="$(date +%s)"
  age=-1
  if [[ "${existing_started_at}" =~ ^[0-9]+$ ]]; then
    age="$((now - existing_started_at))"
  fi

  if [[ "${existing_pid}" =~ ^[0-9]+$ ]] && kill -0 "${existing_pid}" 2>/dev/null; then
    if [[ "${age}" -ge "${DIGEST_LOCK_MAX_AGE_SECONDS}" ]]; then
      print_header "Stale '${lock_name}' run detected (pid=${existing_pid}, age=${age}s). Terminating."
      kill "${existing_pid}" >/dev/null 2>&1 || true

      local waited=0
      while kill -0 "${existing_pid}" 2>/dev/null && [[ "${waited}" -lt "${DIGEST_LOCK_KILL_GRACE_SECONDS}" ]]; do
        sleep 1
        waited="$((waited + 1))"
      done

      if kill -0 "${existing_pid}" 2>/dev/null; then
        print_header "Process ${existing_pid} did not exit after grace period. Sending SIGKILL."
        kill -9 "${existing_pid}" >/dev/null 2>&1 || true
      fi
    else
      echo "ERROR: another '${lock_name}' run is in progress (pid=${existing_pid}, age=${age}s)." >&2
      exit 1
    fi
  else
    print_header "Removing stale '${lock_name}' lock."
  fi

  release_lock "${lock_path}"
  if ! mkdir "${lock_path}" 2>/dev/null; then
    echo "ERROR: another '${lock_name}' run is in progress." >&2
    exit 1
  fi

  printf '%s\n' "$$" > "${lock_path}/pid"
  date +%s > "${lock_path}/started_at"
  trap 'release_lock "'"${lock_path}"'"' EXIT
}

run_with_timeout() {
  local timeout_seconds="$1"
  shift

  if [[ ! "${timeout_seconds}" =~ ^[0-9]+$ ]] || [[ "${timeout_seconds}" -le 0 ]]; then
    "$@"
    return $?
  fi

  "$@" &
  local command_pid="$!"
  local elapsed=0

  while kill -0 "${command_pid}" 2>/dev/null; do
    if [[ "${elapsed}" -ge "${timeout_seconds}" ]]; then
      echo "ERROR: command timed out after ${timeout_seconds}s." >&2
      kill "${command_pid}" >/dev/null 2>&1 || true
      sleep 2
      kill -9 "${command_pid}" >/dev/null 2>&1 || true
      wait "${command_pid}" >/dev/null 2>&1 || true
      return 124
    fi
    sleep 1
    elapsed="$((elapsed + 1))"
  done

  wait "${command_pid}"
}

ensure_local_inbox_file() {
  local local_inbox_path="${REPO_ROOT}/${LOCAL_INBOX_RELATIVE_PATH}"

  mkdir -p "$(dirname "${local_inbox_path}")"

  if [[ -L "${local_inbox_path}" ]]; then
    rm -f "${local_inbox_path}"
  fi

  if [[ ! -f "${local_inbox_path}" ]]; then
    : > "${local_inbox_path}"
  fi
}

sync_inbox_from_icloud() {
  local source_path="${DIGEST_ICLOUD_INBOX_PATH}"
  local local_inbox_path="${REPO_ROOT}/${LOCAL_INBOX_RELATIVE_PATH}"

  ensure_local_inbox_file

  if [[ -z "${source_path}" ]]; then
    print_header "DIGEST_ICLOUD_INBOX_PATH is empty. Skip iCloud inbox sync."
    return 0
  fi

  if [[ "${DIGEST_ICLOUD_AVAILABLE}" != "1" ]]; then
    print_header "iCloud inbox sync disabled for this run. Using local inbox."
    return 0
  fi

  if [[ ! -f "${source_path}" ]]; then
    print_header "iCloud inbox not found (${source_path}). Using local inbox."
    return 0
  fi

  if [[ ! -r "${source_path}" ]]; then
    print_header "iCloud inbox is not readable (${source_path}). Using local inbox."
    if [[ "${DIGEST_DISABLE_ICLOUD_ON_PERMISSION_ERROR}" == "true" ]]; then
      DIGEST_ICLOUD_AVAILABLE="0"
      print_header "Disabled iCloud inbox sync/clear for this run due to permission issue."
    fi
    return 0
  fi

  print_header "Using iCloud inbox path: ${source_path}"
  print_header "Syncing inbox from iCloud"
  local tmp_inbox_path
  tmp_inbox_path="$(mktemp "${local_inbox_path}.tmp.XXXXXX")"
  if ! cat "${source_path}" > "${tmp_inbox_path}"; then
    rm -f "${tmp_inbox_path}"
    print_header "Failed to read iCloud inbox (${source_path}). Using local inbox."
    if [[ "${DIGEST_DISABLE_ICLOUD_ON_PERMISSION_ERROR}" == "true" ]]; then
      DIGEST_ICLOUD_AVAILABLE="0"
      print_header "Disabled iCloud inbox sync/clear for this run due to permission issue."
    fi
    return 0
  fi
  mv "${tmp_inbox_path}" "${local_inbox_path}"
}

clear_icloud_inbox_if_local_cleared() {
  local source_path="${DIGEST_ICLOUD_INBOX_PATH}"
  local local_inbox_path="${REPO_ROOT}/${LOCAL_INBOX_RELATIVE_PATH}"

  ensure_local_inbox_file

  if [[ -z "${source_path}" ]]; then
    print_header "DIGEST_ICLOUD_INBOX_PATH is empty. Skip iCloud inbox clear."
    return 0
  fi

  if [[ "${DIGEST_ICLOUD_AVAILABLE}" != "1" ]]; then
    print_header "Skipping iCloud inbox clear because iCloud sync is disabled for this run."
    return 0
  fi

  if [[ ! -f "${source_path}" ]]; then
    print_header "iCloud inbox not found (${source_path}). Skip iCloud inbox clear."
    return 0
  fi

  if [[ ! -w "${source_path}" ]]; then
    print_header "iCloud inbox is not writable (${source_path}). Skip iCloud inbox clear."
    return 0
  fi

  if [[ -s "${local_inbox_path}" ]]; then
    print_header "Local inbox is not empty after digest. Skip iCloud inbox clear."
    return 0
  fi

  print_header "Clearing iCloud inbox after successful digest"
  if ! : > "${source_path}"; then
    print_header "Failed to clear iCloud inbox (${source_path})."
    return 0
  fi
}

run_git_commit_and_push() {
  local digest_file="${REPO_ROOT}/${DIGEST_RELATIVE_PATH}"
  local commit_message="Add daily digest for ${DIGEST_DATE}"

  print_header "Staging digest files"
  if [[ -f "${digest_file}" ]]; then
    git -C "${REPO_ROOT}" add "${DIGEST_RELATIVE_PATH}"
  fi
  git -C "${REPO_ROOT}" add content/index.json 2>/dev/null || true
  git -C "${REPO_ROOT}" add content/inbox.md 2>/dev/null || true

  if git -C "${REPO_ROOT}" diff --cached --quiet; then
    print_header "No staged changes. Skip commit/push."
    return 0
  fi

  print_header "Committing digest changes"
  git -C "${REPO_ROOT}" commit -m "${commit_message}"

  print_header "Pushing to ${DIGEST_PUSH_REMOTE} ${DIGEST_PUSH_BRANCH}"
  git -C "${REPO_ROOT}" push "${DIGEST_PUSH_REMOTE}" "HEAD:${DIGEST_PUSH_BRANCH}"
}
