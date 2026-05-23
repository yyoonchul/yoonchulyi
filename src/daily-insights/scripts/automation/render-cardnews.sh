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
  echo "Usage: render-cardnews.sh YYYY/MM/DD [article-index]" >&2
  exit 2
fi

if [[ -n "${ARTICLE_INDEX}" && ! "${ARTICLE_INDEX}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: article-index must be a positive integer" >&2
  exit 2
fi

"${SCRIPT_DIR}/render-cardnews-article.sh" "${DATE_PATH}" ${ARTICLE_INDEX:+"${ARTICLE_INDEX}"}
