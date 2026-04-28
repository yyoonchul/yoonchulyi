#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
AGENT_DIR="${CARDNEWS_LAUNCHD_AGENT_DIR:-${HOME}/Library/LaunchAgents}"
LOG_ROOT="${DIGEST_LOG_ROOT:-${HOME}/Library/Logs/daily-insights}"
LAUNCHD_PATH="${CARDNEWS_LAUNCHD_PATH:-${HOME}/.volta/bin:${HOME}/.asdf/shims:${HOME}/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/opt/homebrew/opt/node/bin:/usr/local/opt/node/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
CARDNEWS_LAUNCHD_TIMEZONE="${CARDNEWS_LAUNCHD_TIMEZONE:-${DIGEST_TIMEZONE:-Asia/Seoul}}"
CARDNEWS_LAUNCHD_CODEX_SANDBOX_MODE="${CARDNEWS_LAUNCHD_CODEX_SANDBOX_MODE:-danger-full-access}"
CARDNEWS_LAUNCHD_CODEX_BYPASS_APPROVALS_AND_SANDBOX="${CARDNEWS_LAUNCHD_CODEX_BYPASS_APPROVALS_AND_SANDBOX:-true}"
CARDNEWS_LAUNCHD_CODEX_TIMEOUT_SECONDS="${CARDNEWS_LAUNCHD_CODEX_TIMEOUT_SECONDS:-3600}"
CARDNEWS_LAUNCHD_CODEX_RETRY_MAX_ATTEMPTS="${CARDNEWS_LAUNCHD_CODEX_RETRY_MAX_ATTEMPTS:-2}"
CARDNEWS_LAUNCHD_CODEX_RETRY_INTERVAL_SECONDS="${CARDNEWS_LAUNCHD_CODEX_RETRY_INTERVAL_SECONDS:-300}"
CARDNEWS_LAUNCHD_CLAUDE_TIMEOUT_SECONDS="${CARDNEWS_LAUNCHD_CLAUDE_TIMEOUT_SECONDS:-3600}"
CARDNEWS_LAUNCHD_CLAUDE_RETRY_MAX_ATTEMPTS="${CARDNEWS_LAUNCHD_CLAUDE_RETRY_MAX_ATTEMPTS:-2}"
CARDNEWS_LAUNCHD_CLAUDE_RETRY_INTERVAL_SECONDS="${CARDNEWS_LAUNCHD_CLAUDE_RETRY_INTERVAL_SECONDS:-300}"
CARDNEWS_LAUNCHD_LOCK_MAX_AGE_SECONDS="${CARDNEWS_LAUNCHD_LOCK_MAX_AGE_SECONDS:-43200}"
CARDNEWS_LAUNCHD_LOCK_KILL_GRACE_SECONDS="${CARDNEWS_LAUNCHD_LOCK_KILL_GRACE_SECONDS:-15}"

usage() {
  cat <<'EOF'
Usage:
  cardnews-launchd.sh setup <codex|claude> [HH:MM]
  cardnews-launchd.sh enable <codex|claude>
  cardnews-launchd.sh disable <codex|claude>
  cardnews-launchd.sh status [codex|claude|all]
  cardnews-launchd.sh run-now <codex|claude>
  cardnews-launchd.sh remove <codex|claude>

Examples:
  cardnews-launchd.sh setup claude 22:30
  cardnews-launchd.sh setup codex 22:30
  cardnews-launchd.sh disable codex
  cardnews-launchd.sh status all
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
  echo "com.yoonchul.daily-insights.cardnews.${engine}"
}

plist_for() {
  local engine="$1"
  echo "${AGENT_DIR}/$(label_for "${engine}").plist"
}

runner_for() {
  local engine="$1"
  echo "${REPO_ROOT}/scripts/automation/run-cardnews-${engine}.sh"
}

validate_engine() {
  local engine="$1"
  case "${engine}" in
    codex|claude) ;;
    *) die "engine must be 'codex' or 'claude'." ;;
  esac
}

parse_time() {
  local value="${1:-22:30}"
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
    <key>CARDNEWS_CODEX_SANDBOX_MODE</key>
    <string>${CARDNEWS_LAUNCHD_CODEX_SANDBOX_MODE}</string>
    <key>CARDNEWS_CODEX_BYPASS_APPROVALS_AND_SANDBOX</key>
    <string>${CARDNEWS_LAUNCHD_CODEX_BYPASS_APPROVALS_AND_SANDBOX}</string>
    <key>CARDNEWS_CODEX_TIMEOUT_SECONDS</key>
    <string>${CARDNEWS_LAUNCHD_CODEX_TIMEOUT_SECONDS}</string>
    <key>CARDNEWS_CODEX_RETRY_MAX_ATTEMPTS</key>
    <string>${CARDNEWS_LAUNCHD_CODEX_RETRY_MAX_ATTEMPTS}</string>
    <key>CARDNEWS_CODEX_RETRY_INTERVAL_SECONDS</key>
    <string>${CARDNEWS_LAUNCHD_CODEX_RETRY_INTERVAL_SECONDS}</string>
EOF
  else
    read -r -d '' engine_env_xml <<EOF || true
    <key>CARDNEWS_CLAUDE_TIMEOUT_SECONDS</key>
    <string>${CARDNEWS_LAUNCHD_CLAUDE_TIMEOUT_SECONDS}</string>
    <key>CARDNEWS_CLAUDE_RETRY_MAX_ATTEMPTS</key>
    <string>${CARDNEWS_LAUNCHD_CLAUDE_RETRY_MAX_ATTEMPTS}</string>
    <key>CARDNEWS_CLAUDE_RETRY_INTERVAL_SECONDS</key>
    <string>${CARDNEWS_LAUNCHD_CLAUDE_RETRY_INTERVAL_SECONDS}</string>
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
    <string>${CARDNEWS_LAUNCHD_TIMEZONE}</string>
    <key>DIGEST_LOCK_MAX_AGE_SECONDS</key>
    <string>${CARDNEWS_LAUNCHD_LOCK_MAX_AGE_SECONDS}</string>
    <key>DIGEST_LOCK_KILL_GRACE_SECONDS</key>
    <string>${CARDNEWS_LAUNCHD_LOCK_KILL_GRACE_SECONDS}</string>
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
      time_value="${3:-22:30}"
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
