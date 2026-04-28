#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

acquire_lock "cardnews-claude"
require_command claude

CLAUDE_TIMEOUT_SECONDS="${CARDNEWS_CLAUDE_TIMEOUT_SECONDS:-3600}"
CLAUDE_RETRY_MAX_ATTEMPTS="${CARDNEWS_CLAUDE_RETRY_MAX_ATTEMPTS:-2}"
CLAUDE_RETRY_INTERVAL_SECONDS="${CARDNEWS_CLAUDE_RETRY_INTERVAL_SECONDS:-300}"

if [[ ! "${CLAUDE_RETRY_MAX_ATTEMPTS}" =~ ^[1-9][0-9]*$ ]]; then
  CLAUDE_RETRY_MAX_ATTEMPTS="2"
fi
if [[ ! "${CLAUDE_RETRY_INTERVAL_SECONDS}" =~ ^[0-9]+$ ]]; then
  CLAUDE_RETRY_INTERVAL_SECONDS="300"
fi

digest_path="${REPO_ROOT}/${DIGEST_RELATIVE_PATH}"
if [[ ! -f "${digest_path}" ]]; then
  print_header "Today's digest not found (${DIGEST_RELATIVE_PATH}). Skip card news run."
  exit 0
fi

if ! claude_login_ok; then
  echo "ERROR: Claude Code is not logged in. Run: claude auth login" >&2
  exit 1
fi

DATE_PATH="$(date +%Y/%m/%d)"

read -r -d '' PROMPT <<EOF || true
Use the repository skill at \`.claude/skills/card-news/SKILL.md\` and execute it now for datePath \`${DATE_PATH}\`.

Constraints:
- Today's digest already exists at \`content/${DATE_PATH}.md\`. Do not regenerate it.
- Follow the skill end-to-end: parse digest KO section, generate \`meta/card-news/headers/${DATE_PATH}.json\`, generate \`meta/card-news/queries/${DATE_PATH}.json\`, run the renderer, and write \`meta/card-news/output/${DATE_PATH}/caption.md\` with attribution.
- Renderer execution is hard-coded in this repository. Do not run \`node\`, \`npm\`, \`npx\`, or \`tsx\` directly for rendering. To render, execute exactly: \`scripts/automation/render-cardnews.sh ${DATE_PATH}\`.
- Generate the caption only after \`scripts/automation/render-cardnews.sh ${DATE_PATH}\` succeeds, and read the fresh \`meta/card-news/output/${DATE_PATH}/credits.json\` for attribution.
- Do not run any git commands.
EOF

attempt=1
while true; do
  print_header "Running card news with Claude Code skill (attempt ${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS})"

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
    break
  fi

  if [[ "${attempt}" -ge "${CLAUDE_RETRY_MAX_ATTEMPTS}" ]]; then
    if [[ "${run_status}" -eq 124 ]]; then
      echo "ERROR: claude run timed out after ${CLAUDE_TIMEOUT_SECONDS}s (attempt ${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS})." >&2
      exit 124
    fi
    echo "ERROR: claude run failed with exit code ${run_status} (attempt ${attempt}/${CLAUDE_RETRY_MAX_ATTEMPTS})." >&2
    exit "${run_status}"
  fi

  if [[ "${run_status}" -eq 124 ]]; then
    print_header "Claude run timed out after ${CLAUDE_TIMEOUT_SECONDS}s. Retrying in ${CLAUDE_RETRY_INTERVAL_SECONDS}s."
  else
    print_header "Claude run failed with exit code ${run_status}. Retrying in ${CLAUDE_RETRY_INTERVAL_SECONDS}s."
  fi

  if [[ "${CLAUDE_RETRY_INTERVAL_SECONDS}" -gt 0 ]]; then
    sleep "${CLAUDE_RETRY_INTERVAL_SECONDS}"
  fi
  attempt="$((attempt + 1))"
done

print_header "Verifying card news render output"
"${SCRIPT_DIR}/render-cardnews.sh" "${DATE_PATH}"

print_header "Card news complete. Output: meta/card-news/output/${DATE_PATH}/"
