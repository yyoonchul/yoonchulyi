#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

acquire_lock "cardnews-codex"
require_command codex

CODEX_SANDBOX_MODE="${CARDNEWS_CODEX_SANDBOX_MODE:-danger-full-access}"
CODEX_BYPASS_APPROVALS_AND_SANDBOX="${CARDNEWS_CODEX_BYPASS_APPROVALS_AND_SANDBOX:-true}"
CODEX_TIMEOUT_SECONDS="${CARDNEWS_CODEX_TIMEOUT_SECONDS:-3600}"
CODEX_RETRY_MAX_ATTEMPTS="${CARDNEWS_CODEX_RETRY_MAX_ATTEMPTS:-2}"
CODEX_RETRY_INTERVAL_SECONDS="${CARDNEWS_CODEX_RETRY_INTERVAL_SECONDS:-300}"

if [[ ! "${CODEX_RETRY_MAX_ATTEMPTS}" =~ ^[1-9][0-9]*$ ]]; then
  CODEX_RETRY_MAX_ATTEMPTS="2"
fi
if [[ ! "${CODEX_RETRY_INTERVAL_SECONDS}" =~ ^[0-9]+$ ]]; then
  CODEX_RETRY_INTERVAL_SECONDS="300"
fi

digest_path="${REPO_ROOT}/${DIGEST_RELATIVE_PATH}"
if [[ ! -f "${digest_path}" ]]; then
  print_header "Today's digest not found (${DIGEST_RELATIVE_PATH}). Skip card news run."
  exit 0
fi

if ! codex_login_ok; then
  echo "ERROR: Codex is not logged in. Run: codex login" >&2
  exit 1
fi

DATE_PATH="$(date +%Y/%m/%d)"

read -r -d '' PROMPT <<EOF || true
Use the \`\$card-news\` skill in this repository and execute the full workflow now for datePath \`${DATE_PATH}\`.

Constraints:
- Today's digest already exists at \`content/${DATE_PATH}.md\`. Do not regenerate it.
- Follow the skill end-to-end: parse digest KO section, generate \`meta/card-news/headers/${DATE_PATH}.json\`, generate \`meta/card-news/queries/${DATE_PATH}.json\`, run the renderer, and write \`meta/card-news/output/${DATE_PATH}/caption.md\` with attribution.
- Renderer execution is hard-coded in this repository. Do not run \`node\`, \`npm\`, \`npx\`, or \`tsx\` directly for rendering. To render, execute exactly: \`scripts/automation/render-cardnews.sh ${DATE_PATH}\`.
- Generate the caption only after \`scripts/automation/render-cardnews.sh ${DATE_PATH}\` succeeds, and read the fresh \`meta/card-news/output/${DATE_PATH}/credits.json\` for attribution.
- Do not run any git commands.
EOF

if [[ "${CODEX_BYPASS_APPROVALS_AND_SANDBOX}" == "true" ]]; then
  print_header "Codex mode: bypass approvals+sandbox (non-interactive)"
else
  print_header "Codex mode: sandbox=${CODEX_SANDBOX_MODE} (non-interactive)"
fi

attempt=1
while true; do
  print_header "Running card news with Codex skill (attempt ${attempt}/${CODEX_RETRY_MAX_ATTEMPTS})"

  if [[ "${CODEX_BYPASS_APPROVALS_AND_SANDBOX}" == "true" ]]; then
    set +e
    run_with_timeout "${CODEX_TIMEOUT_SECONDS}" \
      codex exec \
        -c 'model_reasoning_effort="high"' \
        -C "${REPO_ROOT}" \
        --dangerously-bypass-approvals-and-sandbox \
        "${PROMPT}"
    run_status="$?"
    set -e
  else
    set +e
    run_with_timeout "${CODEX_TIMEOUT_SECONDS}" \
      codex exec \
        -c 'model_reasoning_effort="high"' \
        -C "${REPO_ROOT}" \
        -s "${CODEX_SANDBOX_MODE}" \
        "${PROMPT}"
    run_status="$?"
    set -e
  fi

  if [[ "${run_status}" -eq 0 ]]; then
    break
  fi

  if [[ "${attempt}" -ge "${CODEX_RETRY_MAX_ATTEMPTS}" ]]; then
    if [[ "${run_status}" -eq 124 ]]; then
      echo "ERROR: codex run timed out after ${CODEX_TIMEOUT_SECONDS}s (attempt ${attempt}/${CODEX_RETRY_MAX_ATTEMPTS})." >&2
      exit 124
    fi
    echo "ERROR: codex run failed with exit code ${run_status} (attempt ${attempt}/${CODEX_RETRY_MAX_ATTEMPTS})." >&2
    exit "${run_status}"
  fi

  if [[ "${run_status}" -eq 124 ]]; then
    print_header "Codex run timed out after ${CODEX_TIMEOUT_SECONDS}s. Retrying in ${CODEX_RETRY_INTERVAL_SECONDS}s."
  else
    print_header "Codex run failed with exit code ${run_status}. Retrying in ${CODEX_RETRY_INTERVAL_SECONDS}s."
  fi

  if [[ "${CODEX_RETRY_INTERVAL_SECONDS}" -gt 0 ]]; then
    sleep "${CODEX_RETRY_INTERVAL_SECONDS}"
  fi
  attempt="$((attempt + 1))"
done

print_header "Verifying card news render output"
"${SCRIPT_DIR}/render-cardnews.sh" "${DATE_PATH}"

print_header "Card news complete. Output: meta/card-news/output/${DATE_PATH}/"
