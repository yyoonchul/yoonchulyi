#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

acquire_lock "digest-claude"
require_command claude
CLAUDE_TIMEOUT_SECONDS="${DIGEST_CLAUDE_TIMEOUT_SECONDS:-10800}"

if ! claude_login_ok; then
  echo "ERROR: Claude Code is not logged in. Run: claude auth login" >&2
  exit 1
fi

sync_inbox_from_icloud

read -r -d '' PROMPT <<'EOF' || true
Use the repository skill at `.claude/skills/digest/SKILL.md` and execute it now.

Constraints:
- Read URLs from `content/inbox.md`.
- Write/update `content/YYYY/MM/DD.md` and `content/index.json`.
- Clear inbox content after successful processing.
- If inbox has no valid URLs, respond exactly: `📭 Inbox is empty.`
- Do not run any git commands.
EOF

print_header "Running digest with Claude Code skill"
set +e
run_with_timeout "${CLAUDE_TIMEOUT_SECONDS}" \
  claude \
    --print \
    --permission-mode dontAsk \
    --add-dir "${REPO_ROOT}" \
    "${PROMPT}"
run_status="$?"
set -e

if [[ "${run_status}" -eq 124 ]]; then
  echo "ERROR: claude run timed out after ${CLAUDE_TIMEOUT_SECONDS}s." >&2
  exit 124
fi
if [[ "${run_status}" -ne 0 ]]; then
  echo "ERROR: claude run failed with exit code ${run_status}." >&2
  exit "${run_status}"
fi

clear_icloud_inbox_if_local_cleared

run_git_commit_and_push
