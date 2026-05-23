#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

export TZ="${DIGEST_TIMEZONE:-Asia/Seoul}"

LOG_ROOT="${DIGEST_LOG_ROOT:-${HOME}/Library/Logs/daily-insights}"
STATE_ROOT="${DIGEST_STATE_ROOT:-${HOME}/Library/Application Support/daily-insights}"
RUN_LOG_ROOT="${DIGEST_RUN_LOG_ROOT:-${REPO_ROOT}/automation-logs/run-logs}"

mkdir -p "${LOG_ROOT}" "${STATE_ROOT}" "${RUN_LOG_ROOT}"

DIGEST_DATE="$(date +%F)"
DIGEST_RELATIVE_PATH="content/$(date +%Y/%m/%d).md"
DIGEST_PUSH_REMOTE="${DIGEST_PUSH_REMOTE:-origin}"
LOCAL_INBOX_RELATIVE_PATH="${DIGEST_LOCAL_INBOX_RELATIVE_PATH:-content/inbox.md}"
DIGEST_LOCK_MAX_AGE_SECONDS="${DIGEST_LOCK_MAX_AGE_SECONDS:-43200}"
DIGEST_LOCK_KILL_GRACE_SECONDS="${DIGEST_LOCK_KILL_GRACE_SECONDS:-15}"
DIGEST_DISABLE_ICLOUD_ON_PERMISSION_ERROR="${DIGEST_DISABLE_ICLOUD_ON_PERMISSION_ERROR:-true}"
DIGEST_ICLOUD_AVAILABLE="1"
RUN_LOG_PATH=""
RUN_LOG_FINALIZED="0"
ACTIVE_LOCK_PATH=""
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

run_log_prune() {
  if command -v find >/dev/null 2>&1; then
    find "${RUN_LOG_ROOT}" -type f -name '*.md' -mtime +6 -delete 2>/dev/null || true
  fi
}

run_log_init() {
  local workflow="$1"
  local engine="$2"
  local run_id

  run_log_prune
  run_id="$(date '+%Y%m%d-%H%M%S')-${workflow}-${engine}-$$"
  RUN_LOG_PATH="${RUN_LOG_ROOT}/${run_id}.md"
  RUN_LOG_FINALIZED="0"

  {
    printf '# Daily Insights Automation Run\n\n'
    printf -- '- workflow: `%s`\n' "${workflow}"
    printf -- '- engine: `%s`\n' "${engine}"
    printf -- '- started_at: `%s`\n' "$(date '+%F %T %Z')"
    printf -- '- repo: `%s`\n' "${REPO_ROOT}"
    printf -- '- log_file: `%s`\n' "${RUN_LOG_PATH}"
    printf '\n'
  } > "${RUN_LOG_PATH}"
}

run_log_event() {
  local title="$1"
  local body="${2:-}"

  [[ -n "${RUN_LOG_PATH:-}" ]] || return 0
  {
    printf '## %s\n\n' "${title}"
    printf -- '- time: `%s`\n' "$(date '+%F %T %Z')"
    if [[ -n "${body}" ]]; then
      printf '\n%s\n' "${body}"
    fi
    printf '\n'
  } >> "${RUN_LOG_PATH}"
}

run_log_file_snapshot() {
  local title="$1"
  local file_path="$2"

  [[ -n "${RUN_LOG_PATH:-}" ]] || return 0
  {
    printf '## %s\n\n' "${title}"
    printf -- '- time: `%s`\n' "$(date '+%F %T %Z')"
    printf -- '- path: `%s`\n\n' "${file_path}"
    printf '~~~text\n'
    if [[ -f "${file_path}" ]]; then
      if [[ -s "${file_path}" ]]; then
        sed -n '1,$p' "${file_path}" 2>/dev/null || true
      else
        printf '[empty file]\n'
      fi
    else
      printf '[missing file]\n'
    fi
    printf '\n~~~\n\n'
  } >> "${RUN_LOG_PATH}"
}

count_valid_inbox_urls() {
  local inbox_path="$1"
  awk '
    /^[[:space:]]*https?:\/\// { count += 1 }
    END { print count + 0 }
  ' "${inbox_path}" 2>/dev/null || printf '0\n'
}

inbox_is_effectively_empty() {
  local inbox_path="$1"
  [[ -f "${inbox_path}" ]] || return 0
  ! grep -Eq '[^[:space:]]' "${inbox_path}" 2>/dev/null
}

run_log_finish_success() {
  local message="${1:-Run completed successfully.}"

  [[ -n "${RUN_LOG_PATH:-}" ]] || return 0
  run_log_event "Run completed" "${message}"
  RUN_LOG_FINALIZED="1"
}

automation_on_exit() {
  local status="$1"

  if [[ -n "${RUN_LOG_PATH:-}" && "${RUN_LOG_FINALIZED:-0}" != "1" ]]; then
    if [[ "${status}" -eq 0 ]]; then
      run_log_event "Run completed" "Process exited successfully."
    else
      run_log_event "Run failed" "Exit status: \`${status}\`."
    fi
    RUN_LOG_FINALIZED="1"
  fi

  if [[ -n "${ACTIVE_LOCK_PATH:-}" ]]; then
    release_lock "${ACTIVE_LOCK_PATH}"
  fi
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
    ACTIVE_LOCK_PATH="${lock_path}"
    trap 'status=$?; automation_on_exit "${status}"; exit "${status}"' EXIT
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
  ACTIVE_LOCK_PATH="${lock_path}"
  trap 'status=$?; automation_on_exit "${status}"; exit "${status}"' EXIT
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

  if [[ "${DIGEST_SKIP_INBOX_SYNC:-false}" == "true" ]]; then
    print_header "DIGEST_SKIP_INBOX_SYNC=true. Skip iCloud inbox sync."
    run_log_event "iCloud inbox sync skipped" "The caller already prepared \`${LOCAL_INBOX_RELATIVE_PATH}\` for this run."
    return 0
  fi

  if [[ -z "${source_path}" ]]; then
    print_header "DIGEST_ICLOUD_INBOX_PATH is empty. Skip iCloud inbox sync."
    return 0
  fi

  if [[ "${DIGEST_ICLOUD_AVAILABLE}" != "1" ]]; then
    print_header "iCloud inbox sync disabled for this run. Using local inbox."
    run_log_event "iCloud inbox sync skipped" "Pre-sync shortcut mode is active, so the script is using the local repo inbox."
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
  print_header "Moving iCloud inbox into repo (append), then clearing iCloud"
  run_log_event "Moving iCloud inbox into repo inbox" "Source: \`${source_path}\`"$'\n'"Destination: \`${local_inbox_path}\`"
  run_log_file_snapshot "iCloud inbox content before move" "${source_path}"
  local tmp_inbox_path
  tmp_inbox_path="$(mktemp "${local_inbox_path}.icloud.XXXXXX")"
  if ! cat "${source_path}" > "${tmp_inbox_path}"; then
    rm -f "${tmp_inbox_path}"
    print_header "Failed to read iCloud inbox (${source_path}). Using local inbox."
    if [[ "${DIGEST_DISABLE_ICLOUD_ON_PERMISSION_ERROR}" == "true" ]]; then
      DIGEST_ICLOUD_AVAILABLE="0"
      print_header "Disabled iCloud inbox sync/clear for this run due to permission issue."
    fi
    return 0
  fi

  if [[ -s "${tmp_inbox_path}" ]]; then
    if [[ -s "${local_inbox_path}" ]]; then
      printf '\n' >> "${local_inbox_path}"
    fi
    cat "${tmp_inbox_path}" >> "${local_inbox_path}"
  fi
  rm -f "${tmp_inbox_path}"

  if [[ ! -w "${source_path}" ]]; then
    print_header "iCloud inbox is not writable (${source_path}). Skip iCloud clear after move."
    if [[ "${DIGEST_FAIL_ON_ICLOUD_CLEAR_ERROR:-false}" == "true" ]]; then
      return 1
    fi
    return 0
  fi

  if ! : > "${source_path}"; then
    print_header "Failed to clear iCloud inbox (${source_path})."
    run_log_event "iCloud inbox clear failed" "Path: \`${source_path}\`"
    if [[ "${DIGEST_FAIL_ON_ICLOUD_CLEAR_ERROR:-false}" == "true" ]]; then
      return 1
    fi
    return 0
  fi
  run_log_event "iCloud inbox cleared" "Path: \`${source_path}\`"
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

run_daily_insights_publish_commit_and_push() {
  local date_path="${1:-$(date +%Y/%m/%d)}"
  local date_label="${date_path//\//-}"
  local digest_relative_path="content/${date_path}.md"
  local commit_message="${DAILY_INSIGHTS_PUBLISH_COMMIT_MESSAGE:-Publish daily insight for ${date_label}}"
  local staged_any="0"

  print_header "Staging daily insight publish files for ${date_path}"

  for path in \
    "${digest_relative_path}" \
    "content/index.json" \
    "content/inbox.md" \
    "card-news/article-headers/${date_path}.json" \
    "card-news/queries/${date_path}.json" \
    "../../public/daily-insights/${date_path}/cardnews"; do
    if [[ -e "${REPO_ROOT}/${path}" ]]; then
      git -C "${REPO_ROOT}" add "${path}"
      staged_any="1"
    fi
  done

  if [[ "${staged_any}" != "1" ]] || git -C "${REPO_ROOT}" diff --cached --quiet; then
    print_header "No staged publish changes. Skip commit/push."
    return 0
  fi

  print_header "Committing daily insight publish changes"
  git -C "${REPO_ROOT}" commit -m "${commit_message}"

  print_header "Pushing to ${DIGEST_PUSH_REMOTE} ${DIGEST_PUSH_BRANCH}"
  git -C "${REPO_ROOT}" push "${DIGEST_PUSH_REMOTE}" "HEAD:${DIGEST_PUSH_BRANCH}"
}
