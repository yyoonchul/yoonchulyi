#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"
# shellcheck source=./node-env.sh
source "${SCRIPT_DIR}/node-env.sh"

DATE_PATH="${1:-}"
FAIL_ON_MISSING_IMAGES="${CARDNEWS_FAIL_ON_MISSING_IMAGES:-false}"
FAIL_ON_ALL_IMAGES_MISSING="${CARDNEWS_FAIL_ON_ALL_IMAGES_MISSING:-true}"

if [[ ! "${DATE_PATH}" =~ ^[0-9]{4}/[0-9]{2}/[0-9]{2}$ ]]; then
  echo "Usage: render-cardnews.sh YYYY/MM/DD" >&2
  exit 2
fi

digest_path="${REPO_ROOT}/content/${DATE_PATH}.md"
if [[ ! -f "${digest_path}" ]]; then
  echo "ERROR: digest not found: content/${DATE_PATH}.md" >&2
  exit 1
fi

require_node_runtime

print_header "Rendering card news for ${DATE_PATH}"
print_header "Node: $(command -v node) ($(node --version))"
if command -v npx >/dev/null 2>&1; then
  print_header "npx: $(command -v npx)"
else
  print_header "npm: $(command -v npm)"
fi

set -a
if [[ -f "${REPO_ROOT}/.env" ]]; then
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.env"
fi
set +a

print_header "Image API env: unsplash=$([[ -n "${UNSPLASH_ACCESS_KEY:-}" ]] && echo yes || echo no), pexels=$([[ -n "${PEXELS_API_KEY:-}" ]] && echo yes || echo no)"

cd "${REPO_ROOT}"
if command -v npx >/dev/null 2>&1; then
  npx --yes tsx "meta/card-news/generate.ts" "${DATE_PATH}"
else
  npm exec --yes -- tsx "meta/card-news/generate.ts" "${DATE_PATH}"
fi

credits_path="${REPO_ROOT}/meta/card-news/output/${DATE_PATH}/credits.json"
if [[ ! -f "${credits_path}" ]]; then
  echo "ERROR: renderer did not write credits.json: ${credits_path}" >&2
  exit 1
fi

node - "${credits_path}" "${FAIL_ON_MISSING_IMAGES}" "${FAIL_ON_ALL_IMAGES_MISSING}" <<'NODE'
const fs = require('node:fs');
const [creditsPath, failOnMissing, failOnAllMissing] = process.argv.slice(2);
const credits = JSON.parse(fs.readFileSync(creditsPath, 'utf8'));
const missing = credits.filter((credit) => credit.status === 'missing');
const missingSlides = missing.map((credit) => credit.slide).join(', ');

console.log(`[card-news] credits=${credits.length}, missing=${missing.length}${missing.length ? ` (${missingSlides})` : ''}`);

if (credits.length > 0 && missing.length === credits.length && failOnAllMissing === 'true') {
  console.error('[card-news] ERROR: every slide is missing a resolved image.');
  process.exit(1);
}

if (missing.length > 0 && failOnMissing === 'true') {
  console.error('[card-news] ERROR: one or more slides are missing resolved images.');
  process.exit(1);
}
NODE

print_header "Card news render complete: meta/card-news/output/${DATE_PATH}/"
