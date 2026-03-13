# Daily Digest 자동 스케줄 가이드 (Codex / Claude Code)

이 폴더는 macOS `launchd` 기반으로 `digest` 스킬을 매일 자동 실행하기 위한 스크립트를 제공합니다.

## 포함된 스크립트

- `run-digest-codex.sh`: Codex 스킬 버전 실행 + 커밋/푸시
- `run-digest-claude.sh`: Claude Code 스킬 버전 실행 + 커밋/푸시
- `digest-launchd.sh`: 스케줄 설정/켜기/끄기/상태/즉시실행
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

### 1) Codex 버전 스케줄 설정 (기본 08:30)
```bash
./scripts/automation/setup-digest-schedule.sh codex 08:30
```

### 2) Claude Code 버전 스케줄 설정 (기본 08:30)
```bash
./scripts/automation/setup-digest-schedule.sh claude 08:30
```

주의: 두 스케줄을 동시에 켜면 같은 인박스를 중복 처리할 수 있습니다. 보통 하나만 활성화하세요.

## Shortcut 선행 동기화 모드 (Codex)

`run-digest-codex.sh`는 기본적으로 pre-sync shortcut 실행을 지원합니다.

- 기본 shortcut 이름: `digest`
- 기본 지연: `0`초
- 기본 shortcut 타임아웃: `300`초

실행 순서:

1. `shortcuts run "digest"`
2. 로컬 inbox 상태 확인 (비어 있으면 종료)
3. (선택) 지연 후 Codex digest 실행
4. 커밋/푸시

이 모드가 활성화되면 해당 실행에서는 스크립트의 직접 iCloud inbox sync/clear를 건너뜁니다.
즉, iCloud 접근은 shortcut에 맡기고, digest 본 처리는 로컬 `content/inbox.md`를 사용합니다.

중요:

- `digest` shortcut은 **iCloud inbox -> repo inbox 복사 + iCloud 원본 inbox 비움**만 해야 합니다.
- digest 스킬 실행은 shortcut이 아니라 `run-digest-codex.sh`가 담당해야 합니다.
- `run-digest-codex.sh`를 shortcut 내부에서 다시 호출하면 중복 실행/재귀가 발생할 수 있습니다.
- shortcut 이름/지연/타임아웃은 환경변수로 조정할 수 있습니다.
  - `DIGEST_PRE_SYNC_SHORTCUT_NAME`
  - `DIGEST_PRE_SYNC_DELAY_SECONDS`
  - `DIGEST_PRE_SYNC_SHORTCUT_TIMEOUT_SECONDS`

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
./scripts/automation/digest-launchd.sh status all
```

### 즉시 1회 실행
```bash
./scripts/automation/digest-launchd.sh run-now codex
./scripts/automation/digest-launchd.sh run-now claude
```

## 기본 동작

- 스킬 실행 성공 후 아래 파일만 커밋 대상으로 추가합니다.
  - `content/YYYY/MM/DD.md` (오늘 날짜)
  - `content/index.json`
  - `content/inbox.md`
- 커밋 메시지: `Add daily digest for YYYY-MM-DD`
- 푸시: `origin`의 현재 브랜치(`HEAD:<current-branch>`)

## Codex 권한 기본값 (현재)

- `run-digest-codex.sh`는 기본적으로 아래로 실행됩니다.
  - `codex exec --dangerously-bypass-approvals-and-sandbox`
- 즉, 승인/샌드박스 질의 없이 비대화식으로 실행되며, 외부 URL fetch도 도메인 화이트리스트 없이 처리합니다.
- 필요하면 기본값을 환경변수로 바꿀 수 있습니다.
  - `DIGEST_CODEX_BYPASS_APPROVALS_AND_SANDBOX=false`
  - `DIGEST_CODEX_SANDBOX_MODE=workspace-write` (위 값을 `false`로 바꾼 경우에 사용)

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
- Codex 작업 추가:
  - `DIGEST_CODEX_SANDBOX_MODE` (기본 `danger-full-access`)
  - `DIGEST_CODEX_BYPASS_APPROVALS_AND_SANDBOX` (기본 `true`)
  - `DIGEST_PRE_SYNC_SHORTCUT_NAME` (기본 `digest`)
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
  - launchd가 실행하는 체인(쉘/codex)이 iCloud 경로에 접근 가능하도록 최초 1회 선허용이 필요합니다.
- Git 인증:
  - 자동 푸시를 쓰면 keychain/ssh 인증도 비대화식으로 미리 완료되어 있어야 합니다.
