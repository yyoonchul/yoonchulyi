#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

SHORTCUT_RUN_DIGEST_AFTER_SYNC=true \
"${SCRIPT_DIR}/run-digest-from-shortcut-input.sh"
