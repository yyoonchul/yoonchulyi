# Instagram Caption Generation

Produce one Korean Instagram caption (`caption.md`) for a finished card news deck.

## Input

`meta/card-news/output/YYYY/MM/DD/credits.json` — array of per-slide image metadata, e.g.

```json
[
  { "slide": 1, "status": "ok", "source": "unsplash", "author": "Jane Doe",
    "authorUrl": "https://unsplash.com/@janedoe?utm_source=daily-insights&utm_medium=referral",
    "sourceUrl": "https://unsplash.com/photos/abc?utm_source=daily-insights&utm_medium=referral",
    "license": "Unsplash License", "query": "..." },
  { "slide": 2, "status": "missing", "query": "..." }
]
```

Also read the KO summary section of `content/YYYY/MM/DD.md` for content.

## Output shape (`caption.md`)

```md
{줄글 설명 — 오늘 다룬 기사들의 핵심 흐름을 1문단, 2~4문장으로 설명}

---

전체 내용 및 원문 링크는 프로필 링크에서

{해시태그 10~15개}

이미지 출처
{라이선스별 출처 라인}
```

## Body rules

- 한국어 줄글 1문단으로 시작한다. 별도 hook, 제목, 불릿 목록, "오늘의 주제" 섹션을 만들지 않는다.
- 2~4문장으로 오늘 다룬 기사들의 핵심 흐름을 자연스럽게 연결한다.
- 설명형 톤을 유지하되, 첫 문장에서 가장 중요한 이슈를 분명히 드러낸다.
- 이모지는 절대 사용하지 않는다.
- 본문 뒤에는 빈 줄, `---`, 빈 줄, `전체 내용 및 원문 링크는 프로필 링크에서` 순서를 반드시 지킨다.

## Hashtag rules

- 한국어·영어 혼용 OK
- 카테고리 기반 5개 + 범용(#테크뉴스 #AI #데일리인사이트) 5~10개
- 인물명·회사명 상표 태그(#openai, #nvidia)는 사실 관계가 명확할 때만

## Attribution rules (법적 필수)

`credits.json`을 훑어 **서로 다른 (source, author) 조합마다 한 줄**씩 출력. 같은 작가의 여러 슬라이드는 묶어서 한 줄.

### 포맷

| source | 라인 포맷 | 비고 |
|---|---|---|
| `unsplash` | `Photo by {author} on Unsplash — {authorUrl}` | API 가이드라인 의무 |
| `wikimedia` | `{author} / {license} via Wikimedia Commons — {sourceUrl}` | CC BY 라이선스 의무 |
| `pexels` | `Photo by {author} on Pexels — {sourceUrl}` | 권장 |
| `missing` | 출력하지 않음 (기본 그라데이션) | — |

### 예시

```
이미지 출처
Photo by Jane Doe on Unsplash — https://unsplash.com/@janedoe?utm_source=daily-insights&utm_medium=referral
Photo by John Smith on Pexels — https://www.pexels.com/photo/12345/
NASA / Public domain via Wikimedia Commons — https://commons.wikimedia.org/wiki/File:Example.jpg
```

## Constraints

- 출력은 `caption.md` 파일 하나.
- 캡션 전체 길이는 2,200자 이내 (인스타 본문 제한).
- 이모지, 아이콘, 장식 문자를 쓰지 않는다.
- 크레딧 라인 URL은 그대로 유지 (UTM 파라미터 제거 금지 — Unsplash 가이드라인 요구).
