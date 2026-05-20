#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

DATE_PATH="${1:-}"

if [[ ! "${DATE_PATH}" =~ ^[0-9]{4}/[0-9]{2}/[0-9]{2}$ ]]; then
  echo "Usage: send-cardnews-discord.sh YYYY/MM/DD" >&2
  exit 2
fi

ENV_DISCORD_NOTIFY_ENABLED="${DISCORD_NOTIFY_ENABLED:-}"
ENV_DISCORD_FORCE_SEND="${DISCORD_FORCE_SEND:-}"
ENV_DISCORD_WEBHOOK_BATCH_SIZE="${DISCORD_WEBHOOK_BATCH_SIZE:-}"
ENV_DISCORD_WEBHOOK_RETRY_MAX_ATTEMPTS="${DISCORD_WEBHOOK_RETRY_MAX_ATTEMPTS:-}"
ENV_DISCORD_MAX_FILE_BYTES="${DISCORD_MAX_FILE_BYTES:-}"
ENV_DISCORD_STATE_DIR="${DISCORD_STATE_DIR:-}"

set -a
if [[ -f "${REPO_ROOT}/.env" ]]; then
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.env"
fi
set +a

[[ -n "${ENV_DISCORD_NOTIFY_ENABLED}" ]] && DISCORD_NOTIFY_ENABLED="${ENV_DISCORD_NOTIFY_ENABLED}"
[[ -n "${ENV_DISCORD_FORCE_SEND}" ]] && DISCORD_FORCE_SEND="${ENV_DISCORD_FORCE_SEND}"
[[ -n "${ENV_DISCORD_WEBHOOK_BATCH_SIZE}" ]] && DISCORD_WEBHOOK_BATCH_SIZE="${ENV_DISCORD_WEBHOOK_BATCH_SIZE}"
[[ -n "${ENV_DISCORD_WEBHOOK_RETRY_MAX_ATTEMPTS}" ]] && DISCORD_WEBHOOK_RETRY_MAX_ATTEMPTS="${ENV_DISCORD_WEBHOOK_RETRY_MAX_ATTEMPTS}"
[[ -n "${ENV_DISCORD_MAX_FILE_BYTES}" ]] && DISCORD_MAX_FILE_BYTES="${ENV_DISCORD_MAX_FILE_BYTES}"
[[ -n "${ENV_DISCORD_STATE_DIR}" ]] && DISCORD_STATE_DIR="${ENV_DISCORD_STATE_DIR}"

if [[ "${DISCORD_NOTIFY_ENABLED:-false}" != "true" ]]; then
  print_header "Discord notification is disabled. Set DISCORD_NOTIFY_ENABLED=true to send card news."
  exit 0
fi

if [[ -z "${DISCORD_WEBHOOK_URL:-}" ]]; then
  echo "ERROR: DISCORD_WEBHOOK_URL is not set." >&2
  exit 1
fi

require_command curl

OUTPUT_DIR="${REPO_ROOT}/card-news/output/${DATE_PATH}"
if [[ ! -d "${OUTPUT_DIR}" ]]; then
  echo "ERROR: card news output directory not found: card-news/output/${DATE_PATH}" >&2
  exit 1
fi

STATE_DIR="${DISCORD_STATE_DIR:-${STATE_ROOT}/discord-cardnews-sent}"
STATE_FILE="${STATE_DIR}/$(echo "${DATE_PATH}" | tr '/' '-').ok"
if [[ -f "${STATE_FILE}" && "${DISCORD_FORCE_SEND:-false}" != "true" ]]; then
  print_header "Discord card news already sent for ${DATE_PATH}. Set DISCORD_FORCE_SEND=true to resend."
  exit 0
fi

declare -a png_files=()
while IFS= read -r file_path; do
  png_files+=("${file_path}")
done < <(find "${OUTPUT_DIR}" -maxdepth 1 -type f -name '*.png' | sort -V)

if [[ "${#png_files[@]}" -eq 0 ]]; then
  echo "ERROR: no card news PNG files found in card-news/output/${DATE_PATH}" >&2
  exit 1
fi

MAX_FILE_BYTES="${DISCORD_MAX_FILE_BYTES:-10485760}"
BATCH_SIZE="${DISCORD_WEBHOOK_BATCH_SIZE:-10}"
RETRY_MAX_ATTEMPTS="${DISCORD_WEBHOOK_RETRY_MAX_ATTEMPTS:-3}"

if [[ ! "${MAX_FILE_BYTES}" =~ ^[1-9][0-9]*$ ]]; then
  MAX_FILE_BYTES="10485760"
fi
if [[ ! "${BATCH_SIZE}" =~ ^[1-9][0-9]*$ ]]; then
  BATCH_SIZE="10"
fi
if [[ "${BATCH_SIZE}" -gt 10 ]]; then
  BATCH_SIZE="10"
fi
if [[ ! "${RETRY_MAX_ATTEMPTS}" =~ ^[1-9][0-9]*$ ]]; then
  RETRY_MAX_ATTEMPTS="3"
fi

for file_path in "${png_files[@]}"; do
  file_size="$(wc -c < "${file_path}" | tr -d '[:space:]')"
  if [[ "${file_size}" -gt "${MAX_FILE_BYTES}" ]]; then
    echo "ERROR: $(basename "${file_path}") is larger than ${MAX_FILE_BYTES} bytes." >&2
    exit 1
  fi
done

date_label="$(echo "${DATE_PATH}" | tr '/' '-')"
total_count="${#png_files[@]}"
declare -a batch_start_indices=()
declare -a batch_end_indices=()
declare -a batch_labels=()

add_batch_ranges() {
  local start_index="$1"
  local end_index="$2"
  local label="$3"
  local chunk_start chunk_end

  for ((chunk_start = start_index; chunk_start < end_index; chunk_start += BATCH_SIZE)); do
    chunk_end="$((chunk_start + BATCH_SIZE))"
    if [[ "${chunk_end}" -gt "${end_index}" ]]; then
      chunk_end="${end_index}"
    fi

    batch_start_indices+=("${chunk_start}")
    batch_end_indices+=("${chunk_end}")
    batch_labels+=("${label}")
  done
}

current_article_key=""
current_article_label=""
current_start_index=0
for ((file_index = 0; file_index < total_count; file_index++)); do
  file_name="$(basename "${png_files[${file_index}]}")"
  article_key=""
  article_label="card news"
  if [[ "${file_name}" =~ ^([0-9]+)-[0-9]+\.png$ ]]; then
    article_key="${BASH_REMATCH[1]}"
    article_label="article ${article_key}"
  fi

  if [[ "${file_index}" -eq 0 ]]; then
    current_article_key="${article_key}"
    current_article_label="${article_label}"
    current_start_index=0
    continue
  fi

  if [[ "${article_key}" != "${current_article_key}" ]]; then
    add_batch_ranges "${current_start_index}" "${file_index}" "${current_article_label}"
    current_article_key="${article_key}"
    current_article_label="${article_label}"
    current_start_index="${file_index}"
  fi
done
add_batch_ranges "${current_start_index}" "${total_count}" "${current_article_label}"
total_batches="${#batch_start_indices[@]}"

send_batch() {
  local batch_index="$1"
  local start_index="$2"
  local end_index="$3"
  local batch_label="$4"
  local headers_path body_path http_code retry_after attempt payload
  local -a curl_args=()

  payload="{\"content\":\"Daily Insights ${batch_label} ${date_label} (${batch_index}/${total_batches})\"}"

  attempt=1
  while true; do
    headers_path="$(mktemp "${TMPDIR:-/tmp}/discord-headers.XXXXXX")"
    body_path="$(mktemp "${TMPDIR:-/tmp}/discord-body.XXXXXX")"
    curl_args=(-sS -D "${headers_path}" -o "${body_path}" -w "%{http_code}" -F "payload_json=${payload}")

    local file_slot=0
    local file_index
    for ((file_index = start_index; file_index < end_index; file_index++)); do
      curl_args+=(-F "files[${file_slot}]=@${png_files[${file_index}]};type=image/png")
      file_slot="$((file_slot + 1))"
    done
    curl_args+=("${DISCORD_WEBHOOK_URL}")

    set +e
    http_code="$(curl "${curl_args[@]}")"
    curl_status="$?"
    set -e

    if [[ "${curl_status}" -eq 0 && ( "${http_code}" == "200" || "${http_code}" == "204" ) ]]; then
      rm -f "${headers_path}" "${body_path}"
      return 0
    fi

    if [[ "${curl_status}" -eq 0 && "${http_code}" == "429" && "${attempt}" -lt "${RETRY_MAX_ATTEMPTS}" ]]; then
      retry_after="$(awk 'BEGIN { IGNORECASE=1 } /^retry-after:/ { gsub("\r", "", $2); print $2; exit }' "${headers_path}")"
      if [[ -z "${retry_after}" ]]; then
        retry_after="2"
      fi
      print_header "Discord rate limited batch ${batch_index}/${total_batches}. Retrying in ${retry_after}s."
      rm -f "${headers_path}" "${body_path}"
      sleep "${retry_after}"
      attempt="$((attempt + 1))"
      continue
    fi

    echo "ERROR: Discord webhook send failed for batch ${batch_index}/${total_batches} (curl=${curl_status}, http=${http_code})." >&2
    if [[ -s "${body_path}" ]]; then
      sed -n '1,20p' "${body_path}" >&2
    fi
    rm -f "${headers_path}" "${body_path}"
    return 1
  done
}

print_header "Sending ${total_count} card news PNG(s) to Discord for ${DATE_PATH}"
for ((batch_index = 1; batch_index <= total_batches; batch_index++)); do
  batch_array_index="$((batch_index - 1))"
  send_batch \
    "${batch_index}" \
    "${batch_start_indices[${batch_array_index}]}" \
    "${batch_end_indices[${batch_array_index}]}" \
    "${batch_labels[${batch_array_index}]}"
done

mkdir -p "${STATE_DIR}"
{
  printf 'date_path=%s\n' "${DATE_PATH}"
  printf 'sent_at=%s\n' "$(date '+%F %T %Z')"
  printf 'png_count=%s\n' "${total_count}"
} > "${STATE_FILE}"

print_header "Discord card news send complete for ${DATE_PATH}"
