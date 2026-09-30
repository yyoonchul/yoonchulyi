#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

DATE_PATH="${1:-$(date +%Y/%m/%d)}"
QUEUE_ONLY="false"
if [[ "${DATE_PATH}" == "--queue-only" ]]; then
  QUEUE_ONLY="true"
  DATE_PATH="${2:-}"
fi

if [[ "${DATE_PATH}" != "--retry-pending" && ! "${DATE_PATH}" =~ ^[0-9]{4}/[0-9]{2}/[0-9]{2}$ ]]; then
  echo "Usage: run-daily-insights-publish.sh YYYY/MM/DD | --queue-only YYYY/MM/DD | --retry-pending" >&2
  exit 2
fi

acquire_lock "daily-insights-publish"
run_log_init "daily-insights-publish" "git"

if [[ "${DATE_PATH}" != "--retry-pending" ]]; then
  run_log_event "Publishing daily insight" "Digest: \`content/${DATE_PATH}.md\`."
  queue_daily_insights_publish "${DATE_PATH}"
fi

if [[ "${QUEUE_ONLY}" == "true" ]]; then
  run_log_finish_success "Daily Insights publish queued for \`${DATE_PATH}\`."
else
  publish_pending_daily_insights
  run_log_finish_success "All pending Daily Insights publishes completed."
fi
