#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

acquire_lock "cardnews-claude"
run_log_init "cardnews" "claude"
require_command claude

CLAUDE_TIMEOUT_SECONDS="${CARDNEWS_CLAUDE_TIMEOUT_SECONDS:-3600}"
CLAUDE_RETRY_MAX_ATTEMPTS="${CARDNEWS_CLAUDE_RETRY_MAX_ATTEMPTS:-2}"
CLAUDE_RETRY_INTERVAL_SECONDS="${CARDNEWS_CLAUDE_RETRY_INTERVAL_SECONDS:-300}"
DATE_PATH="${1:-$(date +%Y/%m/%d)}"

if [[ ! "${DATE_PATH}" =~ ^[0-9]{4}/[0-9]{2}/[0-9]{2}$ ]]; then
  echo "Usage: run-cardnews-claude.sh [YYYY/MM/DD]" >&2
  exit 2
fi

if [[ ! "${CLAUDE_RETRY_MAX_ATTEMPTS}" =~ ^[1-9][0-9]*$ ]]; then
  CLAUDE_RETRY_MAX_ATTEMPTS="2"
fi
if [[ ! "${CLAUDE_RETRY_INTERVAL_SECONDS}" =~ ^[0-9]+$ ]]; then
  CLAUDE_RETRY_INTERVAL_SECONDS="300"
fi

digest_relative_path="content/${DATE_PATH}.md"
digest_path="${REPO_ROOT}/${digest_relative_path}"
if [[ ! -f "${digest_path}" ]]; then
  print_header "Digest not found (${digest_relative_path}). Skip card news run."
  run_log_finish_success "Digest was not found at \`${digest_relative_path}\`; skipped card news skill."
  exit 0
fi
run_log_event "Digest found for card news" "Path: \`${digest_relative_path}\`."

if ! claude_login_ok; then
  echo "ERROR: Claude Code is not logged in. Run: claude auth login" >&2
  exit 1
fi

read -r -d '' PROMPT <<EOF || true
Use the repository skill at \`.claude/skills/card-news/SKILL.md\` and execute it now for datePath \`${DATE_PATH}\`.

Constraints:
- Today's digest already exists at \`content/${DATE_PATH}.md\`. Do not regenerate it.
- Follow the skill end-to-end: parse digest KO section by article, generate \`card-news/article-headers/${DATE_PATH}.json\`, generate \`card-news/queries/${DATE_PATH}.json\`, and run the article renderer.
- Renderer execution is hard-coded in this repository. Do not run \`node\`, \`npm\`, \`npx\`, or \`tsx\` directly for rendering. To render, execute exactly: \`scripts/automation/render-cardnews-article.sh ${DATE_PATH}\`.
- The renderer must leave public assets available under \`public/daily-insights/${DATE_PATH}/cardnews/\` for the publish step.
- Do not run any git commands.
EOF

attempt=1
while true; do
  print_header "Running card news with Claude Code skill (attempt ${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS})"
  run_log_event "Running card news skill" "Engine: \`claude\`"$'\n'"Attempt: \`${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS}\`"$'\n'"Date path: \`${DATE_PATH}\`."

  set +e
  run_with_timeout "${CLAUDE_TIMEOUT_SECONDS}" \
    claude \
      --print \
      --permission-mode dontAsk \
      --add-dir "${REPO_ROOT}" \
      -p "${PROMPT}"
  run_status="$?"
  set -e

  if [[ "${run_status}" -eq 0 ]]; then
    run_log_event "Card news skill completed" "Attempt: \`${attempt}\`."
    break
  fi

  if [[ "${attempt}" -ge "${CLAUDE_RETRY_MAX_ATTEMPTS}" ]]; then
    run_log_event "Card news skill failed" "Final attempt: \`${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS}\`"$'\n'"Exit status: \`${run_status}\`."
    if [[ "${run_status}" -eq 124 ]]; then
      echo "ERROR: claude run timed out after ${CLAUDE_TIMEOUT_SECONDS}s (attempt ${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS})." >&2
      exit 124
    fi
    echo "ERROR: claude run failed with exit code ${run_status} (attempt ${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS})." >&2
    exit "${run_status}"
  fi

  if [[ "${run_status}" -eq 124 ]]; then
    run_log_event "Card news skill attempt timed out" "Attempt: \`${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS}\`"$'\n'"Retry in: \`${CLAUDE_RETRY_INTERVAL_SECONDS}s\`."
    print_header "Claude run timed out after ${CLAUDE_TIMEOUT_SECONDS}s. Retrying in ${CLAUDE_RETRY_INTERVAL_SECONDS}s."
  else
    run_log_event "Card news skill attempt failed" "Attempt: \`${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS}\`"$'\n'"Exit status: \`${run_status}\`"$'\n'"Retry in: \`${CLAUDE_RETRY_INTERVAL_SECONDS}s\`."
    print_header "Claude run failed with exit code ${run_status}. Retrying in ${CLAUDE_RETRY_INTERVAL_SECONDS}s."
  fi

  if [[ "${CLAUDE_RETRY_INTERVAL_SECONDS}" -gt 0 ]]; then
    sleep "${CLAUDE_RETRY_INTERVAL_SECONDS}"
  fi
  attempt="$((attempt + 1))"
done

print_header "Verifying card news render output"
run_log_event "Verifying card news render output" "Running \`scripts/automation/render-cardnews-article.sh ${DATE_PATH}\`."
"${SCRIPT_DIR}/render-cardnews-article.sh" "${DATE_PATH}"

print_header "Sending card news to Discord"
run_log_event "Sending card news to Discord" "Running \`scripts/automation/send-cardnews-discord.sh ${DATE_PATH}\`."
"${SCRIPT_DIR}/send-cardnews-discord.sh" "${DATE_PATH}"

print_header "Card news complete. Output: card-news/output/${DATE_PATH}/"
run_log_finish_success "Card news automation completed. Output: \`card-news/output/${DATE_PATH}/\`."
