# 📰 Daily Tech Digest

관심 있는 글의 링크를 모아두면, Claude Code가 읽고 요약하여 하루 1파일로 정리해주는 시스템.

## 사용법

### 1. 링크 모으기

`content/inbox.md`에 URL을 한 줄씩 추가한다.

```plaintext
https://techcrunch.com/2025/02/16/some-article
https://stripe.com/blog/api-update
https://news.ycombinator.com/item?id=xxxxx  # 요약만
```

### 2. 다이제스트 생성

Claude Code에서 `/digest` 실행.

```bash
claude
> /digest
```

실행하면 아래 과정이 자동으로 진행된다:

1. 인박스의 URL을 읽고 본문을 수집
2. 각 글을 요약하여 `content/YYYY/MM/DD.md` 생성
3. `content/index.json` 매니페스트 업데이트
4. 인박스 클리어
5. Git 커밋 & 푸시

### 3. 결과 확인

- **로컬**: `content/YYYY/MM/DD.md` 파일

## 구조

```plaintext
├── content/                  # 콘텐츠 폴더
│   ├── inbox.md              # 링크를 넣는 곳
│   ├── index.json            # 다이제스트 매니페스트 (최신순)
│   └── YYYY/MM/DD.md         # 생성된 정리본
├── .claude/skills/digest/    # Claude Code Skill
│   ├── SKILL.md
│   ├── prompt-summarize.md
│   └── template-daily.md
└── README.md
```

## 출력 포맷

- **간단 요약**: 글별 불렛 3개씩 위에 쭉
- **상세 정리**: 글별 10\~20줄 분석 아래에 쭉 (같은 순서)

## 메모 기능

URL 뒤에 `#`으로 메모를 달 수 있다.

- `# 요약만` → 상세 정리 생략
- `# 중요` → 참고용 (처리에 영향 없음)
