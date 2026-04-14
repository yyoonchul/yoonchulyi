#!/usr/bin/env bash
# fetch-yt-transcript.sh — Extract YouTube transcript + metadata via yt-dlp
# Usage: ./fetch-yt-transcript.sh <YouTube URL>
# Output: structured text to stdout (metadata header + transcript body)

set -euo pipefail

URL="${1:-}"

if [[ -z "$URL" ]]; then
  echo "ERROR: No URL provided." >&2
  echo "Usage: $0 <YouTube URL>" >&2
  exit 1
fi

# Validate YouTube URL
if [[ ! "$URL" =~ (youtube\.com|youtu\.be) ]]; then
  echo "ERROR: Not a YouTube URL: $URL" >&2
  exit 1
fi

# Check yt-dlp availability
if ! command -v yt-dlp &>/dev/null; then
  echo "ERROR: yt-dlp is not installed." >&2
  echo "Install with: brew install yt-dlp" >&2
  exit 1
fi

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# Fetch metadata (title, channel, duration)
META_JSON=$(yt-dlp --skip-download --print-json --no-warnings "$URL" 2>/dev/null) || {
  echo "ERROR: Failed to fetch video metadata for $URL" >&2
  exit 1
}

TITLE=$(echo "$META_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('title','Unknown'))")
CHANNEL=$(echo "$META_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('channel','Unknown'))")
DURATION=$(echo "$META_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin).get('duration',0); print(f'{d//3600}:{(d%3600)//60:02d}:{d%60:02d}' if d>=3600 else f'{d//60}:{d%60:02d}')")
UPLOAD_DATE=$(echo "$META_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin).get('upload_date',''); print(f'{d[:4]}-{d[4:6]}-{d[6:]}' if len(d)==8 else 'Unknown')")

# Try to fetch subtitles: prefer manual subs (en, ko), fall back to auto-generated
yt-dlp --skip-download --quiet \
  --write-sub --sub-lang "en,ko" \
  --sub-format vtt \
  --output "$TMPDIR/sub" \
  --no-warnings \
  "$URL" 2>/dev/null || true

# If no manual subs found, try auto-generated
SUB_FILE=$(find "$TMPDIR" -name "*.vtt" | head -1)
if [[ -z "$SUB_FILE" ]]; then
  yt-dlp --skip-download --quiet \
    --write-auto-sub --sub-lang "en,ko" \
    --sub-format vtt \
    --output "$TMPDIR/sub" \
    --no-warnings \
    "$URL" 2>/dev/null || true
  SUB_FILE=$(find "$TMPDIR" -name "*.vtt" | head -1)
fi

if [[ -z "$SUB_FILE" ]]; then
  echo "ERROR: No transcript available for this video." >&2
  exit 1
fi

# Parse VTT: strip headers, timestamps, positioning, and deduplicate lines
TRANSCRIPT=$(python3 -c "
import re, sys

with open('$SUB_FILE', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove VTT header
content = re.sub(r'^WEBVTT.*?\n\n', '', content, flags=re.DOTALL)
# Remove timestamp lines
content = re.sub(r'\d{2}:\d{2}:\d{2}\.\d{3}\s*-->.*\n', '', content)
# Remove positioning tags
content = re.sub(r'<[^>]+>', '', content)
# Remove blank lines and deduplicate consecutive identical lines
lines = [l.strip() for l in content.splitlines() if l.strip()]
deduped = []
for line in lines:
    if not deduped or line != deduped[-1]:
        deduped.append(line)

print('\n'.join(deduped))
")

# Output structured result
cat <<EOF
---
title: $TITLE
channel: $CHANNEL
duration: $DURATION
upload_date: $UPLOAD_DATE
source: YouTube
url: $URL
---

$TRANSCRIPT
EOF
