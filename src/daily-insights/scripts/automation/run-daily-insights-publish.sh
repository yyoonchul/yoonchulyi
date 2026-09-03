#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

DATE_PATH="${1:-$(date +%Y/%m/%d)}"

if [[ ! "${DATE_PATH}" =~ ^[0-9]{4}/[0-9]{2}/[0-9]{2}$ ]]; then
  echo "Usage: run-daily-insights-publish.sh YYYY/MM/DD" >&2
  exit 2
fi

acquire_lock "daily-insights-publish"
run_log_init "daily-insights-publish" "git"

digest_path="${REPO_ROOT}/content/${DATE_PATH}.md"
if [[ ! -f "${digest_path}" ]]; then
  echo "ERROR: digest not found: content/${DATE_PATH}.md" >&2
  exit 1
fi

run_log_event "Publishing daily insight" \
  "Digest: \`content/${DATE_PATH}.md\`."

run_daily_insights_publish_commit_and_push "${DATE_PATH}"
run_log_finish_success "Daily Insights publish completed for \`${DATE_PATH}\`."
