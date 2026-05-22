#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
AGENT_DIR="${DAILY_FLOW_LAUNCHD_AGENT_DIR:-${HOME}/Library/LaunchAgents}"
LOG_ROOT="${DIGEST_LOG_ROOT:-${HOME}/Library/Logs/daily-insights}"
LAUNCHD_PATH="${DAILY_FLOW_LAUNCHD_PATH:-${HOME}/.volta/bin:${HOME}/.asdf/shims:${HOME}/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/opt/homebrew/opt/node/bin:/usr/local/opt/node/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
DAILY_FLOW_LAUNCHD_TIMEZONE="${DAILY_FLOW_LAUNCHD_TIMEZONE:-${DIGEST_TIMEZONE:-Asia/Seoul}}"
DAILY_FLOW_LAUNCHD_ICLOUD_INBOX_PATH="${DAILY_FLOW_LAUNCHD_ICLOUD_INBOX_PATH:-${HOME}/Library/Mobile Documents/iCloud~is~workflow~my~workflows/Documents/daily-insights/inbox.md}"
DAILY_FLOW_LAUNCHD_LOCK_MAX_AGE_SECONDS="${DAILY_FLOW_LAUNCHD_LOCK_MAX_AGE_SECONDS:-43200}"
DAILY_FLOW_LAUNCHD_LOCK_KILL_GRACE_SECONDS="${DAILY_FLOW_LAUNCHD_LOCK_KILL_GRACE_SECONDS:-15}"
DAILY_FLOW_LAUNCHD_DISABLE_ICLOUD_ON_PERMISSION_ERROR="${DAILY_FLOW_LAUNCHD_DISABLE_ICLOUD_ON_PERMISSION_ERROR:-true}"
DAILY_FLOW_LAUNCHD_PRE_SYNC_SHORTCUT_NAME="${DAILY_FLOW_LAUNCHD_PRE_SYNC_SHORTCUT_NAME:-Digest}"
DAILY_FLOW_LAUNCHD_PRE_SYNC_DELAY_SECONDS="${DAILY_FLOW_LAUNCHD_PRE_SYNC_DELAY_SECONDS:-0}"
DAILY_FLOW_LAUNCHD_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS="${DAILY_FLOW_LAUNCHD_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS:-300}"
DAILY_FLOW_LAUNCHD_CODEX_SANDBOX_MODE="${DAILY_FLOW_LAUNCHD_CODEX_SANDBOX_MODE:-danger-full-access}"
DAILY_FLOW_LAUNCHD_CODEX_BYPASS_APPROVALS_AND_SANDBOX="${DAILY_FLOW_LAUNCHD_CODEX_BYPASS_APPROVALS_AND_SANDBOX:-true}"
DAILY_FLOW_LAUNCHD_CODEX_TIMEOUT_SECONDS="${DAILY_FLOW_LAUNCHD_CODEX_TIMEOUT_SECONDS:-10800}"
DAILY_FLOW_LAUNCHD_CODEX_RETRY_MAX_ATTEMPTS="${DAILY_FLOW_LAUNCHD_CODEX_RETRY_MAX_ATTEMPTS:-3}"
DAILY_FLOW_LAUNCHD_CODEX_RETRY_INTERVAL_SECONDS="${DAILY_FLOW_LAUNCHD_CODEX_RETRY_INTERVAL_SECONDS:-600}"
DAILY_FLOW_LAUNCHD_CLAUDE_TIMEOUT_SECONDS="${DAILY_FLOW_LAUNCHD_CLAUDE_TIMEOUT_SECONDS:-10800}"
DAILY_FLOW_LAUNCHD_CLAUDE_RETRY_MAX_ATTEMPTS="${DAILY_FLOW_LAUNCHD_CLAUDE_RETRY_MAX_ATTEMPTS:-3}"
DAILY_FLOW_LAUNCHD_CLAUDE_RETRY_INTERVAL_SECONDS="${DAILY_FLOW_LAUNCHD_CLAUDE_RETRY_INTERVAL_SECONDS:-600}"
DAILY_FLOW_LAUNCHD_CARDNEWS_CODEX_TIMEOUT_SECONDS="${DAILY_FLOW_LAUNCHD_CARDNEWS_CODEX_TIMEOUT_SECONDS:-3600}"
DAILY_FLOW_LAUNCHD_CARDNEWS_CODEX_RETRY_MAX_ATTEMPTS="${DAILY_FLOW_LAUNCHD_CARDNEWS_CODEX_RETRY_MAX_ATTEMPTS:-2}"
DAILY_FLOW_LAUNCHD_CARDNEWS_CODEX_RETRY_INTERVAL_SECONDS="${DAILY_FLOW_LAUNCHD_CARDNEWS_CODEX_RETRY_INTERVAL_SECONDS:-300}"
DAILY_FLOW_LAUNCHD_CARDNEWS_CLAUDE_TIMEOUT_SECONDS="${DAILY_FLOW_LAUNCHD_CARDNEWS_CLAUDE_TIMEOUT_SECONDS:-3600}"
DAILY_FLOW_LAUNCHD_CARDNEWS_CLAUDE_RETRY_MAX_ATTEMPTS="${DAILY_FLOW_LAUNCHD_CARDNEWS_CLAUDE_RETRY_MAX_ATTEMPTS:-2}"
DAILY_FLOW_LAUNCHD_CARDNEWS_CLAUDE_RETRY_INTERVAL_SECONDS="${DAILY_FLOW_LAUNCHD_CARDNEWS_CLAUDE_RETRY_INTERVAL_SECONDS:-300}"
DAILY_FLOW_LAUNCHD_RUN_AT_LOAD="${DAILY_FLOW_LAUNCHD_RUN_AT_LOAD:-true}"

usage() {
  cat <<'EOF'
Usage:
  daily-flow-launchd.sh setup <codex|claude> [HH:MM]
  daily-flow-launchd.sh enable <codex|claude>
  daily-flow-launchd.sh disable <codex|claude>
  daily-flow-launchd.sh status [codex|claude|all]
  daily-flow-launchd.sh run-now <codex|claude>
  daily-flow-launchd.sh remove <codex|claude>

Examples:
  daily-flow-launchd.sh setup codex 08:30
  daily-flow-launchd.sh setup claude 08:30
  daily-flow-launchd.sh disable codex
  daily-flow-launchd.sh status all
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

ensure_system_dirs() {
  mkdir -p "${AGENT_DIR}" "${LOG_ROOT}"
}

label_for() {
  local engine="$1"
  echo "com.yoonchul.daily-insights.daily-flow.${engine}"
}

plist_for() {
  local engine="$1"
  echo "${AGENT_DIR}/$(label_for "${engine}").plist"
}

validate_engine() {
  local engine="$1"
  case "${engine}" in
    codex|claude) ;;
    *) die "engine must be 'codex' or 'claude'." ;;
  esac
}

parse_time() {
  local value="${1:-08:30}"
  local hour minute

  if [[ ! "${value}" =~ ^([01]?[0-9]|2[0-3]):([0-5][0-9])$ ]]; then
    die "time must be HH:MM (24h), got '${value}'."
  fi

  hour="$((10#${BASH_REMATCH[1]}))"
  minute="$((10#${BASH_REMATCH[2]}))"
  printf "%d %d\n" "${hour}" "${minute}"
}

write_plist() {
  local engine="$1"
  local hour="$2"
  local minute="$3"
  local label plist runner engine_env_xml

  label="$(label_for "${engine}")"
  plist="$(plist_for "${engine}")"
  runner="${REPO_ROOT}/scripts/automation/run-daily-flow-${engine}.sh"

  [[ -x "${runner}" ]] || die "runner is not executable: ${runner}"

  engine_env_xml=""
  if [[ "${engine}" == "codex" ]]; then
    read -r -d '' engine_env_xml <<EOF || true
    <key>DIGEST_CODEX_SANDBOX_MODE</key>
    <string>${DAILY_FLOW_LAUNCHD_CODEX_SANDBOX_MODE}</string>
    <key>DIGEST_CODEX_BYPASS_APPROVALS_AND_SANDBOX</key>
    <string>${DAILY_FLOW_LAUNCHD_CODEX_BYPASS_APPROVALS_AND_SANDBOX}</string>
    <key>DIGEST_CODEX_TIMEOUT_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_CODEX_TIMEOUT_SECONDS}</string>
    <key>DIGEST_CODEX_RETRY_MAX_ATTEMPTS</key>
    <string>${DAILY_FLOW_LAUNCHD_CODEX_RETRY_MAX_ATTEMPTS}</string>
    <key>DIGEST_CODEX_RETRY_INTERVAL_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_CODEX_RETRY_INTERVAL_SECONDS}</string>
    <key>CARDNEWS_CODEX_SANDBOX_MODE</key>
    <string>${DAILY_FLOW_LAUNCHD_CODEX_SANDBOX_MODE}</string>
    <key>CARDNEWS_CODEX_BYPASS_APPROVALS_AND_SANDBOX</key>
    <string>${DAILY_FLOW_LAUNCHD_CODEX_BYPASS_APPROVALS_AND_SANDBOX}</string>
    <key>CARDNEWS_CODEX_TIMEOUT_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_CARDNEWS_CODEX_TIMEOUT_SECONDS}</string>
    <key>CARDNEWS_CODEX_RETRY_MAX_ATTEMPTS</key>
    <string>${DAILY_FLOW_LAUNCHD_CARDNEWS_CODEX_RETRY_MAX_ATTEMPTS}</string>
    <key>CARDNEWS_CODEX_RETRY_INTERVAL_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_CARDNEWS_CODEX_RETRY_INTERVAL_SECONDS}</string>
EOF
  else
    read -r -d '' engine_env_xml <<EOF || true
    <key>DIGEST_CLAUDE_TIMEOUT_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_CLAUDE_TIMEOUT_SECONDS}</string>
    <key>DIGEST_CLAUDE_RETRY_MAX_ATTEMPTS</key>
    <string>${DAILY_FLOW_LAUNCHD_CLAUDE_RETRY_MAX_ATTEMPTS}</string>
    <key>DIGEST_CLAUDE_RETRY_INTERVAL_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_CLAUDE_RETRY_INTERVAL_SECONDS}</string>
    <key>CARDNEWS_CLAUDE_TIMEOUT_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_CARDNEWS_CLAUDE_TIMEOUT_SECONDS}</string>
    <key>CARDNEWS_CLAUDE_RETRY_MAX_ATTEMPTS</key>
    <string>${DAILY_FLOW_LAUNCHD_CARDNEWS_CLAUDE_RETRY_MAX_ATTEMPTS}</string>
    <key>CARDNEWS_CLAUDE_RETRY_INTERVAL_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_CARDNEWS_CLAUDE_RETRY_INTERVAL_SECONDS}</string>
EOF
  fi

  cat > "${plist}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${runner}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${REPO_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${LAUNCHD_PATH}</string>
    <key>DIGEST_TIMEZONE</key>
    <string>${DAILY_FLOW_LAUNCHD_TIMEZONE}</string>
    <key>DIGEST_ICLOUD_INBOX_PATH</key>
    <string>${DAILY_FLOW_LAUNCHD_ICLOUD_INBOX_PATH}</string>
    <key>DIGEST_LOCK_MAX_AGE_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_LOCK_MAX_AGE_SECONDS}</string>
    <key>DIGEST_LOCK_KILL_GRACE_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_LOCK_KILL_GRACE_SECONDS}</string>
    <key>DIGEST_DISABLE_ICLOUD_ON_PERMISSION_ERROR</key>
    <string>${DAILY_FLOW_LAUNCHD_DISABLE_ICLOUD_ON_PERMISSION_ERROR}</string>
    <key>DIGEST_PRE_SYNC_SHORTCUT_NAME</key>
    <string>${DAILY_FLOW_LAUNCHD_PRE_SYNC_SHORTCUT_NAME}</string>
    <key>DIGEST_PRE_SYNC_DELAY_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_PRE_SYNC_DELAY_SECONDS}</string>
    <key>DIGEST_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS</key>
    <string>${DAILY_FLOW_LAUNCHD_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS}</string>
${engine_env_xml}
  </dict>
  <key>RunAtLoad</key>
  <${DAILY_FLOW_LAUNCHD_RUN_AT_LOAD}/>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${LOG_ROOT}/${label}.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_ROOT}/${label}.stderr.log</string>
</dict>
</plist>
EOF
}

enable_job() {
  local engine="$1"
  local label plist

  label="$(label_for "${engine}")"
  plist="$(plist_for "${engine}")"
  [[ -f "${plist}" ]] || die "plist not found: ${plist}"

  launchctl bootout "gui/${UID}" "${plist}" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/${UID}" "${plist}"
  launchctl enable "gui/${UID}/${label}" >/dev/null 2>&1 || true
}

disable_job() {
  local engine="$1"
  local plist

  plist="$(plist_for "${engine}")"
  [[ -f "${plist}" ]] || die "plist not found: ${plist}"
  launchctl bootout "gui/${UID}" "${plist}" >/dev/null 2>&1 || true
}

status_job() {
  local engine="$1"
  local label plist

  label="$(label_for "${engine}")"
  plist="$(plist_for "${engine}")"

  if [[ ! -f "${plist}" ]]; then
    echo "${engine}: NOT INSTALLED (${plist})"
    return 0
  fi

  if launchctl print "gui/${UID}/${label}" >/dev/null 2>&1; then
    echo "${engine}: ENABLED (${label})"
  else
    echo "${engine}: DISABLED (${label})"
  fi

  echo "  plist: ${plist}"
  echo "  logs : ${LOG_ROOT}/${label}.stdout.log"
}

run_now() {
  local engine="$1"
  local label

  label="$(label_for "${engine}")"
  if ! launchctl print "gui/${UID}/${label}" >/dev/null 2>&1; then
    die "job is not enabled. Run setup/enable first."
  fi
  launchctl kickstart -k "gui/${UID}/${label}"
}

remove_job() {
  local engine="$1"
  local plist

  plist="$(plist_for "${engine}")"
  disable_job "${engine}" || true
  rm -f "${plist}"
}

main() {
  local action="${1:-}"
  local engine="${2:-}"
  local time_value hour minute

  case "${action}" in
    setup)
      validate_engine "${engine}"
      time_value="${3:-08:30}"
      ensure_system_dirs
      read -r hour minute < <(parse_time "${time_value}")
      write_plist "${engine}" "${hour}" "${minute}"
      enable_job "${engine}"
      status_job "${engine}"
      ;;
    enable)
      validate_engine "${engine}"
      enable_job "${engine}"
      status_job "${engine}"
      ;;
    disable)
      validate_engine "${engine}"
      disable_job "${engine}"
      status_job "${engine}"
      ;;
    status)
      case "${engine:-all}" in
        all)
          status_job codex
          status_job claude
          ;;
        codex|claude)
          status_job "${engine}"
          ;;
        *)
          die "status target must be codex, claude, or all."
          ;;
      esac
      ;;
    run-now)
      validate_engine "${engine}"
      run_now "${engine}"
      ;;
    remove)
      validate_engine "${engine}"
      remove_job "${engine}"
      status_job "${engine}"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
