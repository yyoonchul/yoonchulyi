#!/usr/bin/env bash
set -euo pipefail

# Schedules the weekly Daily Insights letter. Same shape as digest-launchd.sh,
# but fires once a week instead of once a day.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
SITE_ROOT="$(cd -- "${REPO_ROOT}/../.." && pwd)"
AGENT_DIR="${DIGEST_LAUNCHD_AGENT_DIR:-${HOME}/Library/LaunchAgents}"
LOG_ROOT="${DIGEST_LOG_ROOT:-${HOME}/Library/Logs/daily-insights}"
LAUNCHD_PATH="${DIGEST_LAUNCHD_PATH:-/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
LAUNCHD_TIMEZONE="${WEEKLY_LETTER_LAUNCHD_TIMEZONE:-${DIGEST_TIMEZONE:-Asia/Seoul}}"
LAUNCHD_AGENT_TIMEOUT_SECONDS="${WEEKLY_LETTER_LAUNCHD_AGENT_TIMEOUT_SECONDS:-1800}"
LAUNCHD_AGENT_RETRY_MAX_ATTEMPTS="${WEEKLY_LETTER_LAUNCHD_AGENT_RETRY_MAX_ATTEMPTS:-3}"
LAUNCHD_AGENT_RETRY_INTERVAL_SECONDS="${WEEKLY_LETTER_LAUNCHD_AGENT_RETRY_INTERVAL_SECONDS:-300}"
LAUNCHD_PUSH_STATE="${WEEKLY_LETTER_LAUNCHD_PUSH_STATE:-true}"
LAUNCHD_DRY_RUN="${WEEKLY_LETTER_LAUNCHD_DRY_RUN:-false}"

usage() {
  cat <<'EOF'
Usage:
  weekly-letter-launchd.sh setup <codex|claude> [HH:MM] [WEEKDAY]
  weekly-letter-launchd.sh enable <codex|claude>
  weekly-letter-launchd.sh disable <codex|claude>
  weekly-letter-launchd.sh status [codex|claude|all]
  weekly-letter-launchd.sh run-now <codex|claude>
  weekly-letter-launchd.sh remove <codex|claude>

WEEKDAY is 0-6 with 0 = Sunday. Defaults to 1 (Monday) at 08:30.

Examples:
  weekly-letter-launchd.sh setup codex 08:30
  weekly-letter-launchd.sh setup codex 09:00 1
  weekly-letter-launchd.sh status all
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

label_for() {
  echo "com.yoonchul.daily-insights.weekly-letter.$1"
}

plist_for() {
  echo "${AGENT_DIR}/$(label_for "$1").plist"
}

runner_for() {
  echo "${REPO_ROOT}/scripts/automation/run-weekly-letter-$1.sh"
}

validate_engine() {
  case "${1:-}" in
    codex|claude) ;;
    *) die "engine must be 'codex' or 'claude'." ;;
  esac
}

parse_time() {
  local value="${1:-08:30}"
  if [[ ! "${value}" =~ ^([01]?[0-9]|2[0-3]):([0-5][0-9])$ ]]; then
    die "time must be HH:MM (24h), got '${value}'."
  fi
  printf "%d %d\n" "$((10#${BASH_REMATCH[1]}))" "$((10#${BASH_REMATCH[2]}))"
}

parse_weekday() {
  local value="${1:-1}"
  if [[ ! "${value}" =~ ^[0-6]$ ]]; then
    die "weekday must be 0-6 with 0 = Sunday, got '${value}'."
  fi
  echo "${value}"
}

write_plist() {
  local engine="$1" hour="$2" minute="$3" weekday="$4"
  local label plist runner

  label="$(label_for "${engine}")"
  plist="$(plist_for "${engine}")"
  runner="$(runner_for "${engine}")"

  [[ -x "${runner}" ]] || die "runner is not executable: ${runner}"

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
  <string>${SITE_ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${LAUNCHD_PATH}</string>
    <key>DIGEST_TIMEZONE</key>
    <string>${LAUNCHD_TIMEZONE}</string>
    <key>WEEKLY_LETTER_AGENT_TIMEOUT_SECONDS</key>
    <string>${LAUNCHD_AGENT_TIMEOUT_SECONDS}</string>
    <key>WEEKLY_LETTER_AGENT_RETRY_MAX_ATTEMPTS</key>
    <string>${LAUNCHD_AGENT_RETRY_MAX_ATTEMPTS}</string>
    <key>WEEKLY_LETTER_AGENT_RETRY_INTERVAL_SECONDS</key>
    <string>${LAUNCHD_AGENT_RETRY_INTERVAL_SECONDS}</string>
    <key>WEEKLY_LETTER_PUSH_STATE</key>
    <string>${LAUNCHD_PUSH_STATE}</string>
    <key>WEEKLY_LETTER_DRY_RUN</key>
    <string>${LAUNCHD_DRY_RUN}</string>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>${weekday}</integer>
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
  local label plist
  label="$(label_for "$1")"
  plist="$(plist_for "$1")"
  [[ -f "${plist}" ]] || die "plist not found: ${plist}"

  launchctl bootout "gui/${UID}" "${plist}" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/${UID}" "${plist}"
  launchctl enable "gui/${UID}/${label}" >/dev/null 2>&1 || true
}

disable_job() {
  local plist
  plist="$(plist_for "$1")"
  [[ -f "${plist}" ]] || die "plist not found: ${plist}"
  launchctl bootout "gui/${UID}" "${plist}" >/dev/null 2>&1 || true
}

status_job() {
  local label plist
  label="$(label_for "$1")"
  plist="$(plist_for "$1")"

  if [[ ! -f "${plist}" ]]; then
    echo "$1: NOT INSTALLED (${plist})"
    return 0
  fi

  if launchctl print "gui/${UID}/${label}" >/dev/null 2>&1; then
    echo "$1: ENABLED (${label})"
  else
    echo "$1: DISABLED (${label})"
  fi

  echo "  plist: ${plist}"
  echo "  logs : ${LOG_ROOT}/${label}.stdout.log"
}

run_now() {
  local label
  label="$(label_for "$1")"
  launchctl print "gui/${UID}/${label}" >/dev/null 2>&1 ||
    die "job is not enabled. Run setup/enable first."
  launchctl kickstart -k "gui/${UID}/${label}"
}

remove_job() {
  disable_job "$1" || true
  rm -f "$(plist_for "$1")"
}

main() {
  local action="${1:-}" engine="${2:-}" hour minute weekday

  case "${action}" in
    setup)
      validate_engine "${engine}"
      mkdir -p "${AGENT_DIR}" "${LOG_ROOT}"
      read -r hour minute < <(parse_time "${3:-08:30}")
      weekday="$(parse_weekday "${4:-1}")"
      write_plist "${engine}" "${hour}" "${minute}" "${weekday}"
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
        codex|claude) status_job "${engine}" ;;
        *) die "status target must be codex, claude, or all." ;;
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
