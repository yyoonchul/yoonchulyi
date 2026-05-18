#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=./node-env.sh
source "${SCRIPT_DIR}/node-env.sh"

DATE_PATH="${1:-}"
ARTICLE_INDEX="${2:-}"

if [[ ! "${DATE_PATH}" =~ ^[0-9]{4}/[0-9]{2}/[0-9]{2}$ ]]; then
  echo "Usage: render-cardnews-article.sh YYYY/MM/DD [article-index]" >&2
  exit 2
fi

if [[ -n "${ARTICLE_INDEX}" && ! "${ARTICLE_INDEX}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: article-index must be a positive integer" >&2
  exit 2
fi

digest_path="${REPO_ROOT}/content/${DATE_PATH}.md"
if [[ ! -f "${digest_path}" ]]; then
  echo "ERROR: digest not found: content/${DATE_PATH}.md" >&2
  exit 1
fi

require_node_runtime

print_header "Rendering article card news for ${DATE_PATH}${ARTICLE_INDEX:+ article ${ARTICLE_INDEX}}"
print_header "Node: $(command -v node) ($(node --version))"

set -a
if [[ -f "${REPO_ROOT}/.env" ]]; then
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.env"
fi
set +a

cd "${REPO_ROOT}"
if command -v npx >/dev/null 2>&1; then
  npx --yes tsx "card-news/generate-article.ts" "${DATE_PATH}" ${ARTICLE_INDEX:+"${ARTICLE_INDEX}"}
else
  npm exec --yes -- tsx "card-news/generate-article.ts" "${DATE_PATH}" ${ARTICLE_INDEX:+"${ARTICLE_INDEX}"}
fi

print_header "Article card news render complete: card-news/output/${DATE_PATH}/"
