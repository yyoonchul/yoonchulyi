#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./common.sh
source "${SCRIPT_DIR}/common.sh"

set -a
if [[ -f "${REPO_ROOT}/.env" ]]; then
  # shellcheck source=/dev/null
  source "${REPO_ROOT}/.env"
fi
set +a

if [[ "${DISCORD_INBOX_SYNC_ENABLED:-false}" != "true" ]]; then
  print_header "Discord inbox sync is disabled. Set DISCORD_INBOX_SYNC_ENABLED=true to enable it."
  exit 0
fi

if [[ -z "${DISCORD_BOT_TOKEN:-}" ]]; then
  echo "ERROR: DISCORD_BOT_TOKEN is not set." >&2
  exit 1
fi

if [[ -z "${DISCORD_INBOX_CHANNEL_ID:-}" ]]; then
  echo "ERROR: DISCORD_INBOX_CHANNEL_ID is not set." >&2
  exit 1
fi

require_command curl
require_command python3

ensure_local_inbox_file

STATE_DIR="${DISCORD_INBOX_STATE_DIR:-${STATE_ROOT}/discord-inbox}"
STATE_FILE="${STATE_DIR}/state.json"
LOCAL_INBOX_PATH="${REPO_ROOT}/${LOCAL_INBOX_RELATIVE_PATH}"
API_BASE="https://discord.com/api/v10"
FETCH_LIMIT="${DISCORD_INBOX_FETCH_LIMIT:-100}"
MAX_PAGES="${DISCORD_INBOX_MAX_PAGES:-10}"
CHECK_EMOJI="${DISCORD_INBOX_CHECK_EMOJI:-%E2%9C%85}"
RETRY_MAX_ATTEMPTS="${DISCORD_INBOX_RETRY_MAX_ATTEMPTS:-3}"

if [[ ! "${FETCH_LIMIT}" =~ ^[1-9][0-9]*$ ]]; then
  FETCH_LIMIT="100"
fi
if [[ "${FETCH_LIMIT}" -gt 100 ]]; then
  FETCH_LIMIT="100"
fi
if [[ ! "${MAX_PAGES}" =~ ^[1-9][0-9]*$ ]]; then
  MAX_PAGES="10"
fi
if [[ ! "${RETRY_MAX_ATTEMPTS}" =~ ^[1-9][0-9]*$ ]]; then
  RETRY_MAX_ATTEMPTS="3"
fi

mkdir -p "${STATE_DIR}"

tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/discord-inbox-sync.XXXXXX")"
messages_jsonl="${tmp_dir}/messages.jsonl"
to_react_path="${tmp_dir}/to-react.txt"
append_urls_path="${tmp_dir}/append-urls.txt"
summary_path="${tmp_dir}/summary.txt"
trap 'rm -rf "${tmp_dir}"' EXIT

before_query=""
page=1
oldest_message_id=""
while [[ "${page}" -le "${MAX_PAGES}" ]]; do
  response_body="${tmp_dir}/response-${page}.json"
  response_headers="${tmp_dir}/headers-${page}.txt"
  request_url="${API_BASE}/channels/${DISCORD_INBOX_CHANNEL_ID}/messages?limit=${FETCH_LIMIT}${before_query}"

  http_code="$(curl -sS -D "${response_headers}" -o "${response_body}" -w "%{http_code}" \
    -H "Authorization: Bot ${DISCORD_BOT_TOKEN}" \
    -H "User-Agent: daily-insights-discord-inbox-sync" \
    "${request_url}")"

  if [[ "${http_code}" != "200" ]]; then
    echo "ERROR: Discord inbox fetch failed (http=${http_code})." >&2
    if [[ -s "${response_body}" ]]; then
      sed -n '1,20p' "${response_body}" >&2
    fi
    exit 1
  fi

  batch_info="$(python3 - "${response_body}" "${messages_jsonl}" <<'PY'
import json
import sys

body_path, jsonl_path = sys.argv[1:3]
with open(body_path, "r", encoding="utf-8") as handle:
    messages = json.load(handle)
if not isinstance(messages, list):
    messages = []
with open(jsonl_path, "a", encoding="utf-8") as out:
    for message in messages:
        out.write(json.dumps(message, ensure_ascii=False) + "\n")
oldest = min((message.get("id", "") for message in messages), key=lambda value: int(value), default="")
print(f"{len(messages)} {oldest}")
PY
)"
  batch_count="${batch_info%% *}"
  batch_oldest="${batch_info#* }"

  if [[ "${batch_count}" -eq 0 ]]; then
    break
  fi

  oldest_message_id="${batch_oldest}"
  before_query="&before=${oldest_message_id}"

  if [[ "${batch_count}" -lt "${FETCH_LIMIT}" ]]; then
    break
  fi

  page="$((page + 1))"
done

if [[ ! -s "${messages_jsonl}" ]]; then
  print_header "Discord inbox sync found no messages."
  exit 0
fi

python3 - "${messages_jsonl}" "${LOCAL_INBOX_PATH}" "${append_urls_path}" "${to_react_path}" "${summary_path}" <<'PY'
import json
import re
import sys

messages_path, inbox_path, append_urls_path, to_react_path, summary_path = sys.argv[1:6]
url_pattern = re.compile(r"https?://[^\s<>()\[\]{}\"']+")

existing = set()
try:
    with open(inbox_path, "r", encoding="utf-8") as handle:
        for line in handle:
            value = line.strip()
            if value.startswith(("http://", "https://")):
                existing.add(value.rstrip("/"))
except FileNotFoundError:
    pass

messages = []
with open(messages_path, "r", encoding="utf-8") as handle:
    for line in handle:
        if line.strip():
            messages.append(json.loads(line))

deduped = {message.get("id"): message for message in messages if message.get("id")}
ordered = sorted(deduped.values(), key=lambda item: int(item["id"]))

seen = set()
append_urls = []
to_react = []
unchecked_with_urls = 0

for message in ordered:
    reactions = message.get("reactions") or []
    has_check = any((reaction.get("emoji") or {}).get("name") == "✅" for reaction in reactions)
    if has_check:
        continue

    content = message.get("content") or ""
    urls = []
    for match in url_pattern.findall(content):
        url = match.rstrip(".,;:!?)]}>\"'")
        if url:
            urls.append(url)

    if not urls:
        continue

    unchecked_with_urls += 1
    to_react.append(message["id"])

    for url in urls:
        key = url.rstrip("/")
        if key in existing or key in seen:
            continue
        existing.add(key)
        seen.add(key)
        append_urls.append(url)

with open(append_urls_path, "w", encoding="utf-8") as handle:
    for url in append_urls:
        handle.write(url + "\n")

with open(to_react_path, "w", encoding="utf-8") as handle:
    for message_id in to_react:
        handle.write(message_id + "\n")

with open(summary_path, "w", encoding="utf-8") as handle:
    handle.write(f"fetched_messages={len(deduped)}\n")
    handle.write(f"unchecked_link_messages={unchecked_with_urls}\n")
    handle.write(f"new_urls={len(append_urls)}\n")
    handle.write(f"reaction_messages={len(to_react)}\n")
PY

append_url_count="$(wc -l < "${append_urls_path}" | tr -d '[:space:]')"
reaction_count="$(wc -l < "${to_react_path}" | tr -d '[:space:]')"

if [[ "${append_url_count}" -gt 0 ]]; then
  python3 - "${LOCAL_INBOX_PATH}" "${append_urls_path}" <<'PY'
import sys

inbox_path, urls_path = sys.argv[1:3]
with open(urls_path, "r", encoding="utf-8") as handle:
    urls = [line.strip() for line in handle if line.strip()]
if not urls:
    raise SystemExit

try:
    with open(inbox_path, "rb") as handle:
        existing = handle.read()
except FileNotFoundError:
    existing = b""

with open(inbox_path, "ab") as handle:
    if existing and not existing.endswith(b"\n"):
        handle.write(b"\n")
    for url in urls:
        handle.write(url.encode("utf-8") + b"\n")
PY
fi

put_reaction() {
  local message_id="$1"
  local attempt=1
  local headers_path body_path http_code retry_after curl_status

  while true; do
    headers_path="$(mktemp "${tmp_dir}/reaction-headers.XXXXXX")"
    body_path="$(mktemp "${tmp_dir}/reaction-body.XXXXXX")"

    set +e
    http_code="$(curl -sS -D "${headers_path}" -o "${body_path}" -w "%{http_code}" \
      -X PUT \
      -H "Authorization: Bot ${DISCORD_BOT_TOKEN}" \
      -H "User-Agent: daily-insights-discord-inbox-sync" \
      "${API_BASE}/channels/${DISCORD_INBOX_CHANNEL_ID}/messages/${message_id}/reactions/${CHECK_EMOJI}/@me")"
    curl_status="$?"
    set -e

    if [[ "${curl_status}" -eq 0 && ( "${http_code}" == "204" || "${http_code}" == "200" ) ]]; then
      rm -f "${headers_path}" "${body_path}"
      return 0
    fi

    if [[ "${curl_status}" -eq 0 && "${http_code}" == "429" && "${attempt}" -lt "${RETRY_MAX_ATTEMPTS}" ]]; then
      retry_after="$(awk 'BEGIN { IGNORECASE=1 } /^retry-after:/ { gsub("\r", "", $2); print $2; exit }' "${headers_path}")"
      if [[ -z "${retry_after}" ]]; then
        retry_after="2"
      fi
      print_header "Discord reaction rate limited. Retrying in ${retry_after}s."
      rm -f "${headers_path}" "${body_path}"
      sleep "${retry_after}"
      attempt="$((attempt + 1))"
      continue
    fi

    echo "ERROR: failed to add check reaction to Discord message ${message_id} (curl=${curl_status}, http=${http_code})." >&2
    if [[ -s "${body_path}" ]]; then
      sed -n '1,20p' "${body_path}" >&2
    fi
    rm -f "${headers_path}" "${body_path}"
    return 1
  done
}

if [[ "${reaction_count}" -gt 0 ]]; then
  while IFS= read -r message_id; do
    [[ -n "${message_id}" ]] || continue
    put_reaction "${message_id}"
  done < "${to_react_path}"
fi

python3 - "${STATE_FILE}" "${DISCORD_INBOX_CHANNEL_ID}" "${summary_path}" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

state_file, channel_id, summary_path = sys.argv[1:4]
summary = {}
with open(summary_path, "r", encoding="utf-8") as handle:
    for line in handle:
        if "=" in line:
            key, value = line.strip().split("=", 1)
            try:
                summary[key] = int(value)
            except ValueError:
                summary[key] = value

data = {
    "channel_id": channel_id,
    "last_synced_at": datetime.now(timezone.utc).isoformat(),
    **summary,
}
os.makedirs(os.path.dirname(state_file), exist_ok=True)
with open(state_file, "w", encoding="utf-8") as handle:
    json.dump(data, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
PY

print_header "Discord inbox sync complete. Added ${append_url_count} new URL(s); checked ${reaction_count} message(s)."
