#!/usr/bin/env bash

# Bootstrap Node for non-interactive shells such as launchd.
# Source this file from automation scripts before calling node/npm/npx.

prepend_path_if_dir() {
  local dir="$1"
  if [[ -d "${dir}" ]]; then
    case ":${PATH:-}:" in
      *":${dir}:"*) ;;
      *) PATH="${dir}:${PATH:-}" ;;
    esac
  fi
}

bootstrap_node_env() {
  prepend_path_if_dir "${CARDNEWS_NODE_BIN_DIR:-}"
  prepend_path_if_dir "${DAILY_INSIGHTS_NODE_BIN_DIR:-}"
  prepend_path_if_dir "${HOME}/.volta/bin"
  prepend_path_if_dir "${HOME}/.local/bin"
  prepend_path_if_dir "/opt/homebrew/bin"
  prepend_path_if_dir "/opt/homebrew/sbin"
  prepend_path_if_dir "/usr/local/bin"
  prepend_path_if_dir "/opt/homebrew/opt/node/bin"
  prepend_path_if_dir "/usr/local/opt/node/bin"

  if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
    export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
    # shellcheck source=/dev/null
    source "${HOME}/.nvm/nvm.sh"
    if ! command -v node >/dev/null 2>&1; then
      nvm use --silent default >/dev/null 2>&1 || nvm use --silent node >/dev/null 2>&1 || true
    fi
  fi

  if [[ -s "${HOME}/.asdf/asdf.sh" ]]; then
    # shellcheck source=/dev/null
    source "${HOME}/.asdf/asdf.sh"
  elif [[ -s "/opt/homebrew/opt/asdf/libexec/asdf.sh" ]]; then
    # shellcheck source=/dev/null
    source "/opt/homebrew/opt/asdf/libexec/asdf.sh"
  fi

  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --shell bash)"
    fnm use --silent-if-unchanged default >/dev/null 2>&1 || true
  fi

  if command -v mise >/dev/null 2>&1; then
    eval "$(mise activate bash)"
  fi

  export PATH
}

require_node_runtime() {
  bootstrap_node_env

  if ! command -v node >/dev/null 2>&1; then
    echo "ERROR: node is not available for automation. Set CARDNEWS_NODE_BIN_DIR or install Node in a standard location." >&2
    echo "PATH=${PATH:-}" >&2
    return 1
  fi

  if ! command -v npx >/dev/null 2>&1 && ! command -v npm >/dev/null 2>&1; then
    echo "ERROR: neither npx nor npm is available for automation. Set CARDNEWS_NODE_BIN_DIR to a Node bin directory." >&2
    echo "PATH=${PATH:-}" >&2
    return 1
  fi
}
