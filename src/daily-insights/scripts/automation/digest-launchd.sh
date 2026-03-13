#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
AGENT_DIR="${DIGEST_LAUNCHD_AGENT_DIR:-${HOME}/Library/LaunchAgents}"
LOG_ROOT="${DIGEST_LOG_ROOT:-${HOME}/Library/Logs/daily-insights}"
LAUNCHD_PATH="${DIGEST_LAUNCHD_PATH:-/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
DIGEST_LAUNCHD_TIMEZONE="${DIGEST_LAUNCHD_TIMEZONE:-${DIGEST_TIMEZONE:-Asia/Seoul}}"
DIGEST_LAUNCHD_ICLOUD_INBOX_PATH="${DIGEST_LAUNCHD_ICLOUD_INBOX_PATH:-${HOME}/Library/Mobile Documents/iCloud~is~workflow~my~workflows/Documents/daily-insights/inbox.md}"
DIGEST_LAUNCHD_CODEX_SANDBOX_MODE="${DIGEST_LAUNCHD_CODEX_SANDBOX_MODE:-danger-full-access}"
DIGEST_LAUNCHD_CODEX_BYPASS_APPROVALS_AND_SANDBOX="${DIGEST_LAUNCHD_CODEX_BYPASS_APPROVALS_AND_SANDBOX:-true}"
DIGEST_LAUNCHD_CODEX_TIMEOUT_SECONDS="${DIGEST_LAUNCHD_CODEX_TIMEOUT_SECONDS:-10800}"
DIGEST_LAUNCHD_PRE_SYNC_SHORTCUT_NAME="${DIGEST_LAUNCHD_PRE_SYNC_SHORTCUT_NAME:-digest}"
DIGEST_LAUNCHD_PRE_SYNC_DELAY_SECONDS="${DIGEST_LAUNCHD_PRE_SYNC_DELAY_SECONDS:-0}"
DIGEST_LAUNCHD_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS="${DIGEST_LAUNCHD_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS:-300}"
DIGEST_LAUNCHD_CLAUDE_TIMEOUT_SECONDS="${DIGEST_LAUNCHD_CLAUDE_TIMEOUT_SECONDS:-10800}"
DIGEST_LAUNCHD_LOCK_MAX_AGE_SECONDS="${DIGEST_LAUNCHD_LOCK_MAX_AGE_SECONDS:-43200}"
DIGEST_LAUNCHD_LOCK_KILL_GRACE_SECONDS="${DIGEST_LAUNCHD_LOCK_KILL_GRACE_SECONDS:-15}"
DIGEST_LAUNCHD_DISABLE_ICLOUD_ON_PERMISSION_ERROR="${DIGEST_LAUNCHD_DISABLE_ICLOUD_ON_PERMISSION_ERROR:-true}"

usage() {
  cat <<'EOF'
Usage:
  digest-launchd.sh setup <codex|claude> [HH:MM]
  digest-launchd.sh enable <codex|claude>
  digest-launchd.sh disable <codex|claude>
  digest-launchd.sh status [codex|claude|all]
  digest-launchd.sh run-now <codex|claude>
  digest-launchd.sh remove <codex|claude>

Examples:
  digest-launchd.sh setup codex 08:30
  digest-launchd.sh setup claude 08:30
  digest-launchd.sh disable codex
  digest-launchd.sh status all
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
  echo "com.yoonchul.daily-insights.digest.${engine}"
}

plist_for() {
  local engine="$1"
  echo "${AGENT_DIR}/$(label_for "${engine}").plist"
}

runner_for() {
  local engine="$1"
  echo "${REPO_ROOT}/scripts/automation/run-digest-${engine}.sh"
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
  runner="$(runner_for "${engine}")"

  [[ -x "${runner}" ]] || die "runner is not executable: ${runner}"

  engine_env_xml=""
  if [[ "${engine}" == "codex" ]]; then
    read -r -d '' engine_env_xml <<EOF || true
    <key>DIGEST_CODEX_SANDBOX_MODE</key>
    <string>${DIGEST_LAUNCHD_CODEX_SANDBOX_MODE}</string>
    <key>DIGEST_CODEX_BYPASS_APPROVALS_AND_SANDBOX</key>
    <string>${DIGEST_LAUNCHD_CODEX_BYPASS_APPROVALS_AND_SANDBOX}</string>
    <key>DIGEST_CODEX_TIMEOUT_SECONDS</key>
    <string>${DIGEST_LAUNCHD_CODEX_TIMEOUT_SECONDS}</string>
    <key>DIGEST_PRE_SYNC_SHORTCUT_NAME</key>
    <string>${DIGEST_LAUNCHD_PRE_SYNC_SHORTCUT_NAME}</string>
    <key>DIGEST_PRE_SYNC_DELAY_SECONDS</key>
    <string>${DIGEST_LAUNCHD_PRE_SYNC_DELAY_SECONDS}</string>
    <key>DIGEST_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS</key>
    <string>${DIGEST_LAUNCHD_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS}</string>
EOF
  else
    read -r -d '' engine_env_xml <<EOF || true
    <key>DIGEST_CLAUDE_TIMEOUT_SECONDS</key>
    <string>${DIGEST_LAUNCHD_CLAUDE_TIMEOUT_SECONDS}</string>
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
    <string>${DIGEST_LAUNCHD_TIMEZONE}</string>
    <key>DIGEST_ICLOUD_INBOX_PATH</key>
    <string>${DIGEST_LAUNCHD_ICLOUD_INBOX_PATH}</string>
    <key>DIGEST_LOCK_MAX_AGE_SECONDS</key>
    <string>${DIGEST_LAUNCHD_LOCK_MAX_AGE_SECONDS}</string>
    <key>DIGEST_LOCK_KILL_GRACE_SECONDS</key>
    <string>${DIGEST_LAUNCHD_LOCK_KILL_GRACE_SECONDS}</string>
    <key>DIGEST_DISABLE_ICLOUD_ON_PERMISSION_ERROR</key>
    <string>${DIGEST_LAUNCHD_DISABLE_ICLOUD_ON_PERMISSION_ERROR}</string>
${engine_env_xml}
  </dict>
  <key>RunAtLoad</key>
  <false/>
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
