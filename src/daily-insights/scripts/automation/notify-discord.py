"""Send a Daily Insights result using the existing Discord bot."""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("result", choices=("success", "failure"))
    parser.add_argument("--detail", default="")
    parser.add_argument("--date", action="append", default=[])
    parser.add_argument("--run-url", default="")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    lines = ["✅ 다이제스트 발행 푸시 완료" if args.result == "success" else "❌ 다이제스트 작업 실패"]
    if args.detail:
        lines.append(args.detail)
    if args.result == "success":
        lines.extend(f"https://yoonchulyi.com/daily-insights/{date}/" for date in args.date)
    elif args.date:
        lines.append("대상: " + ", ".join(args.date))
    if args.run_url:
        lines.append(args.run_url)
    payload = {"content": "\n".join(lines)[:2000], "allowed_mentions": {"parse": []}}
    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False))
        return 0

    token = os.environ.get("DISCORD_BOT_TOKEN")
    channel = os.environ.get("DISCORD_INBOX_CHANNEL_ID")
    if not token or not channel:
        print("Discord notification skipped: configure DISCORD_BOT_TOKEN and DISCORD_INBOX_CHANNEL_ID.", file=sys.stderr)
        return 0
    if not channel.isdecimal():
        print("Invalid DISCORD_INBOX_CHANNEL_ID.", file=sys.stderr)
        return 1
    request = urllib.request.Request(
        f"https://discord.com/api/v10/channels/{channel}/messages",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bot {token}", "Content-Type": "application/json",
                 "User-Agent": "DailyInsights (https://yoonchulyi.com, 1.0)"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            response.read()
    except urllib.error.HTTPError as error:
        print(f"Discord notification failed (HTTP {error.code}).", file=sys.stderr)
        return 1
    except (urllib.error.URLError, TimeoutError):
        print("Discord notification failed (network error).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
