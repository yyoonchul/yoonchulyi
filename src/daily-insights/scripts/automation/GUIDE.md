# Daily Insights 자동 스케줄 가이드 (Codex / Claude Code)

이 폴더는 macOS `launchd` 기반으로 daily insights 작업을 매일 자동 실행하기 위한 스크립트를 제공합니다.

권장 방식은 `daily-flow-launchd.sh`로 **하나의 스케줄**만 등록하는 것입니다. daily flow는 기본적으로 `Digest` shortcut을 먼저 실행해 iCloud inbox를 repo inbox로 옮긴 뒤, `digest -> card-news -> daily-insights-publish` 순서로 실행합니다.

## 포함된 스크립트

- `run-daily-flow-codex.sh`: Codex로 iCloud inbox move + digest + card news + publish 순차 실행
- `run-daily-flow-claude.sh`: Claude Code로 iCloud inbox move + digest + card news + publish 순차 실행
- `run-daily-flow.sh`: daily flow 공통 구현. 직접 실행보다 위 엔진별 래퍼 사용을 권장합니다.
- `daily-flow-launchd.sh`: daily flow 스케줄 설정/켜기/끄기/상태/즉시실행
- `run-digest-codex.sh`: Codex digest 스킬 버전 실행. 커밋/푸시는 하지 않습니다.
- `run-digest-claude.sh`: Claude Code digest 스킬 버전 실행. 커밋/푸시는 하지 않습니다.
- `run-daily-insights-publish.sh`: digest/card news 산출물을 한 번에 커밋/푸시해 GitHub Pages 배포를 트리거합니다.
- `digest-launchd.sh`: 스케줄 설정/켜기/끄기/상태/즉시실행
- `cardnews-launchd.sh`: card news 개별 스케줄 설정/켜기/끄기/상태/즉시실행
- `setup-digest-schedule.sh`: 빠른 설정 래퍼
- `disable-digest-schedule.sh`: 빠른 끄기 래퍼

## 사전 준비

1. Codex 로그인
```bash
codex login
```

2. Claude Code 로그인
```bash
claude auth login
```

3. Git 푸시 권한 확인 (`origin` 원격)

## 빠른 시작

### 1) Codex daily flow 스케줄 설정 (기본 08:30)
```bash
./scripts/automation/daily-flow-launchd.sh setup codex 08:30
```

### 2) Claude Code daily flow 스케줄 설정 (기본 08:30)
```bash
./scripts/automation/daily-flow-launchd.sh setup claude 08:30
```

주의: `daily-flow`, `digest`, `cardnews` 스케줄을 동시에 켜면 같은 인박스를 중복 처리하거나 stale digest로 card news를 만들 수 있습니다. 보통 `daily-flow` 하나만 활성화하세요.

## Daily Flow 실행 순서

1. `Digest` shortcut을 실행해 iCloud inbox를 `content/inbox.md`로 옮기고 iCloud inbox를 비웁니다.
2. local inbox를 백업합니다.
3. digest 스킬을 실행합니다.
4. digest 실패 시 local inbox를 백업 상태로 복원하고 card news를 실행하지 않습니다.
5. digest 성공 시 local inbox를 명시적으로 비웁니다.
6. 오늘 digest 파일이 새로 생성되었거나 변경된 것을 검증합니다.
7. card news 스킬을 실행해 카드뉴스, sidecar JSON, public cardnews URL 자산을 생성합니다.
8. `daily-insights-publish` 단계에서 digest와 card news 산출물을 한 번에 커밋/푸시합니다.

## Shortcut 선행 동기화 모드 (Codex / Claude Code)

`run-daily-flow.sh`, `run-digest-codex.sh`, `run-digest-claude.sh`는 기본적으로 pre-sync shortcut 실행을 지원합니다. launchd로 등록한 daily flow는 이 모드가 기본으로 켜집니다.

- daily-flow launchd 기본 shortcut 이름: `Digest`
- 기본 지연: `0`초
- 기본 shortcut 타임아웃: `300`초

실행 순서:

1. `shortcuts run "Digest"`
2. 로컬 inbox 상태 확인 (비어 있으면 종료)
3. (선택) 지연 후 선택한 엔진의 digest 실행
4. digest 생성 후 daily flow가 card news와 publish 단계를 이어서 실행

이 모드가 활성화되면 해당 실행에서는 스크립트의 직접 iCloud inbox sync/clear를 건너뜁니다.
즉, iCloud 접근은 shortcut에 맡기고, digest 본 처리는 로컬 `content/inbox.md`를 사용합니다.

중요:

- pre-sync shortcut은 **iCloud inbox -> repo inbox 복사 + iCloud 원본 inbox 비움**만 해야 합니다.
- digest 스킬 실행은 shortcut이 아니라 `run-digest-codex.sh` 또는 `run-digest-claude.sh`가 담당해야 합니다.
- 엔진 실행 스크립트를 shortcut 내부에서 다시 호출하면 중복 실행/재귀가 발생할 수 있습니다.
- shortcut 이름/지연/타임아웃은 환경변수로 조정할 수 있습니다.
  - `DIGEST_PRE_SYNC_SHORTCUT_NAME`
  - `DIGEST_PRE_SYNC_DELAY_SECONDS`
  - `DIGEST_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS`
  - daily-flow launchd plist 생성 시 기본값을 바꾸려면 각각 `DAILY_FLOW_LAUNCHD_PRE_SYNC_SHORTCUT_NAME`, `DAILY_FLOW_LAUNCHD_PRE_SYNC_DELAY_SECONDS`, `DAILY_FLOW_LAUNCHD_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS`를 사용하세요.

## 켜기 / 끄기

### 끄기
```bash
./scripts/automation/disable-digest-schedule.sh codex
./scripts/automation/disable-digest-schedule.sh claude
```

### 다시 켜기
```bash
./scripts/automation/digest-launchd.sh enable codex
./scripts/automation/digest-launchd.sh enable claude
```

### 상태 확인
```bash
./scripts/automation/daily-flow-launchd.sh status all
```

### 즉시 1회 실행
```bash
./scripts/automation/daily-flow-launchd.sh run-now codex
./scripts/automation/daily-flow-launchd.sh run-now claude
```

## 기본 동작

- `daily-insights-publish` 실행 성공 후 아래 파일을 커밋 대상으로 추가합니다.
  - `content/YYYY/MM/DD.md` (오늘 날짜)
  - `content/index.json`
  - `content/inbox.md`
  - `card-news/article-headers/YYYY/MM/DD.json`
  - `card-news/queries/YYYY/MM/DD.json`
  - `public/daily-insights/YYYY/MM/DD/cardnews/`
- 커밋 메시지: `Publish daily insight for YYYY-MM-DD`
- 푸시: `origin`의 현재 브랜치(`HEAD:<current-branch>`)

## Codex 권한 기본값 (현재)

- `run-digest-codex.sh`는 기본적으로 아래로 실행됩니다.
  - `codex exec --dangerously-bypass-approvals-and-sandbox`
- 즉, 승인/샌드박스 질의 없이 비대화식으로 실행되며, 외부 URL fetch도 도메인 화이트리스트 없이 처리합니다.
- Codex 실행 실패 시 폴백 재시도 기본값:
  - `DIGEST_CODEX_RETRY_MAX_ATTEMPTS=3` (총 시도 횟수)
  - `DIGEST_CODEX_RETRY_INTERVAL_SECONDS=600` (시도 간 대기 초)
- 필요하면 기본값을 환경변수로 바꿀 수 있습니다.
  - `DIGEST_CODEX_BYPASS_APPROVALS_AND_SANDBOX=false`
  - `DIGEST_CODEX_SANDBOX_MODE=workspace-write` (위 값을 `false`로 바꾼 경우에 사용)
  - `DIGEST_CODEX_RETRY_MAX_ATTEMPTS=5`
  - `DIGEST_CODEX_RETRY_INTERVAL_SECONDS=300`

원하면 환경변수로 변경 가능합니다.

```bash
DIGEST_PUSH_REMOTE=origin DIGEST_PUSH_BRANCH=main ./scripts/automation/run-digest-codex.sh
```

## launchd에 고정되는 환경변수

`digest-launchd.sh setup ...`로 plist를 만들 때 아래 값이 `EnvironmentVariables`에 저장됩니다.

- 공통:
  - `PATH`
  - `DIGEST_TIMEZONE` (기본 `Asia/Seoul`)
  - `DIGEST_ICLOUD_INBOX_PATH`  
    기본값: `~/Library/Mobile Documents/iCloud~is~workflow~my~workflows/Documents/daily-insights/inbox.md`
  - `DIGEST_PRE_SYNC_SHORTCUT_NAME` (daily-flow 기본 `Digest`)
  - `DIGEST_PRE_SYNC_DELAY_SECONDS` (daily-flow 기본 `0`)
  - `DIGEST_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS` (daily-flow 기본 `300`)
- Codex 작업 추가:
  - `DIGEST_CODEX_SANDBOX_MODE` (기본 `danger-full-access`)
  - `DIGEST_CODEX_BYPASS_APPROVALS_AND_SANDBOX` (기본 `true`)
  - `DIGEST_CODEX_RETRY_MAX_ATTEMPTS` (기본 `3`)
  - `DIGEST_CODEX_RETRY_INTERVAL_SECONDS` (기본 `600`)
- Claude Code 작업 추가:
  - `DIGEST_CLAUDE_TIMEOUT_SECONDS` (기본 `10800`)
  - `DIGEST_CLAUDE_RETRY_MAX_ATTEMPTS` (기본 `3`)
  - `DIGEST_CLAUDE_RETRY_INTERVAL_SECONDS` (기본 `600`)
- pre-sync shortcut 모드:
  - `DIGEST_PRE_SYNC_SHORTCUT_NAME` (기본 `Digest`)
  - `DIGEST_PRE_SYNC_DELAY_SECONDS` (기본 `0`)
  - `DIGEST_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS` (기본 `300`)

따라서 스케줄 실행 시마다 수동으로 경로나 권한 모드를 다시 입력할 필요가 없습니다.

## 로그 위치

- `~/Library/Logs/daily-insights/com.yoonchul.daily-insights.digest.codex.stdout.log`
- `~/Library/Logs/daily-insights/com.yoonchul.daily-insights.digest.codex.stderr.log`
- `~/Library/Logs/daily-insights/com.yoonchul.daily-insights.digest.claude.stdout.log`
- `~/Library/Logs/daily-insights/com.yoonchul.daily-insights.digest.claude.stderr.log`

## 트러블슈팅

- Codex 에러 `model_reasoning_effort xhigh`:
  - 실행 스크립트에서 `model_reasoning_effort="high"`를 강제 override 하므로 자동 실행에는 영향이 없도록 처리했습니다.
- `Not logged in`:
  - `codex login` 또는 `claude auth login` 후 재시도.
- 인박스가 심링크(`content/inbox.md`)인 경우:
  - 심링크 타겟 파일 권한/접근 가능 여부를 확인하세요.
- macOS iCloud/TCC 권한:
  - 레포 설정만으로는 부여할 수 없습니다(앱/프로세스 단위 권한).
  - launchd가 실행하는 체인(쉘/shortcuts/codex/claude)이 iCloud 경로에 접근 가능하도록 최초 1회 선허용이 필요합니다.
- Git 인증:
  - 자동 푸시를 쓰면 keychain/ssh 인증도 비대화식으로 미리 완료되어 있어야 합니다.
