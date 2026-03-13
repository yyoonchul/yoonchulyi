#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

ENGINE="${1:-codex}"
TIME_VALUE="${2:-08:30}"

"${SCRIPT_DIR}/digest-launchd.sh" setup "${ENGINE}" "${TIME_VALUE}"
