# 📰 Daily Tech Digest

## English

Collect article links in `content/inbox.md`, then run the digest skill to generate one daily markdown summary file.

### How To Use

1. Add links

Put one URL per line in `content/inbox.md`:

```plaintext
https://techcrunch.com/2025/02/16/some-article
https://stripe.com/blog/api-update
https://news.ycombinator.com/item?id=xxxxx  # summary-only
```

2. Run digest

Claude Code:

```bash
claude
> /digest
```

Codex:

```text
$digest
```

3. Check output

- Local file: `content/YYYY/MM/DD.md`

### What Happens

1. Read URLs from inbox
2. Fetch source content
3. Generate digest at `content/YYYY/MM/DD.md`
4. Update `content/index.json`
5. Clear `content/inbox.md`

### Structure

```plaintext
├── content/
│   ├── inbox.md
│   ├── index.json
│   └── YYYY/MM/DD.md
├── .codex/skills/digest/
├── .claude/skills/digest/
└── README.md
```

### Output Format

- Quick summary: 3 bullets per article
- Detailed notes: deeper analysis in the same order

### Memo Tags

Add `#` notes after URL lines:

- `# summary-only`: skip detailed notes
- `# important`: informational note only

### Automation

For Codex/Claude scheduler setup, on/off commands, and operations guide:

- `scripts/automation/GUIDE.md`

---

## 한국어

`content/inbox.md`에 링크를 모아두고 digest 스킬을 실행하면, 하루 1개의 다이제스트 마크다운 파일이 생성됩니다.

### 사용법

1. 링크 추가

`content/inbox.md`에 URL을 한 줄씩 입력:

```plaintext
https://techcrunch.com/2025/02/16/some-article
https://stripe.com/blog/api-update
https://news.ycombinator.com/item?id=xxxxx  # 요약만
```

2. 다이제스트 실행

Claude Code:

```bash
claude
> /digest
```

Codex:

```text
$digest
```

3. 결과 확인

- 로컬 파일: `content/YYYY/MM/DD.md`

### 실행 시 동작

1. 인박스 URL 읽기
2. 원문 수집
3. `content/YYYY/MM/DD.md` 생성
4. `content/index.json` 업데이트
5. `content/inbox.md` 비우기

### 구조

```plaintext
├── content/
│   ├── inbox.md
│   ├── index.json
│   └── YYYY/MM/DD.md
├── .codex/skills/digest/
├── .claude/skills/digest/
└── README.md
```

### 출력 포맷

- 간단 요약: 글마다 3개 불렛
- 상세 정리: 같은 순서로 심화 내용 정리

### 메모 태그

URL 뒤 `#` 메모:

- `# 요약만`: 상세 정리 생략
- `# 중요`: 참고용 메모

### 자동 스케줄

Codex/Claude 스케줄 설정, 켜기/끄기, 운영 가이드:

- `scripts/automation/GUIDE.md`
