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

cardnews_output_dir="${REPO_ROOT}/card-news/output/${DATE_PATH}"
if [[ ! -d "${cardnews_output_dir}" ]] || ! compgen -G "${cardnews_output_dir}/*.jpg" >/dev/null; then
  echo "ERROR: card news JPEGs not found: card-news/output/${DATE_PATH}" >&2
  exit 1
fi

public_cardnews_dir="${REPO_ROOT}/../../public/daily-insights/${DATE_PATH}/cardnews"
if [[ ! -d "${public_cardnews_dir}" ]] || ! compgen -G "${public_cardnews_dir}/*" >/dev/null; then
  echo "ERROR: public card news assets not found: public/daily-insights/${DATE_PATH}/cardnews" >&2
  exit 1
fi

run_log_event "Publishing daily insight" \
  "Digest: \`content/${DATE_PATH}.md\`"$'\n'"Card news: \`card-news/output/${DATE_PATH}/\`"$'\n'"Public route: \`/daily-insights/${DATE_PATH}/cardnews/1-1\`."

run_daily_insights_publish_commit_and_push "${DATE_PATH}"
run_log_finish_success "Daily Insights publish completed for \`${DATE_PATH}\`."
