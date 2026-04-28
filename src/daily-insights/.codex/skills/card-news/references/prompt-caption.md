# Instagram Caption Generation

Produce one Korean Instagram caption (`caption.md`) for a finished card news deck.

## Inputs

- `meta/card-news/output/YYYY/MM/DD/credits.json` — per-slide image metadata.
- `content/YYYY/MM/DD.md` — read the KO summary section for content.

Sample `credits.json` entry:

```json
{ "slide": 1, "status": "ok", "source": "unsplash", "author": "Jane Doe",
  "authorUrl": "https://unsplash.com/@janedoe?utm_source=daily-insights&utm_medium=referral",
  "sourceUrl": "https://unsplash.com/photos/abc?utm_source=daily-insights&utm_medium=referral",
  "license": "Unsplash License", "query": "..." }
```

`status: "missing"` entries mean the built-in gradient was used — skip them for attribution.

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

- Start with one Korean prose paragraph. Do not write a separate hook, title, bullet list, or "오늘의 주제" section.
- Explain the day's core flow in 2–4 connected sentences.
- Keep an explanatory editorial tone and make the most important issue clear in the first sentence.
- Never use emojis, icons, or decorative symbols.
- After the body, use exactly: blank line, `---`, blank line, `전체 내용 및 원문 링크는 프로필 링크에서`.

## Hashtag rules

- 한국어·영어 혼용 OK.
- 카테고리 기반 5개 + 범용 (#테크뉴스 #AI #데일리인사이트) 5~10개.
- 상표 태그(#openai, #nvidia)는 사실 관계가 명확할 때만.

## Attribution rules (legal, mandatory)

Group `credits.json` by unique `(source, author)`. Emit one line per group.

| source | Line format | Notes |
|---|---|---|
| `unsplash` | `Photo by {author} on Unsplash — {authorUrl}` | Unsplash API guidelines **required** |
| `wikimedia` | `{author} / {license} via Wikimedia Commons — {sourceUrl}` | CC BY **required** |
| `pexels` | `Photo by {author} on Pexels — {sourceUrl}` | Recommended; always include |
| `missing` | — | Skip (built-in gradient) |

### Example

```
이미지 출처
Photo by Jane Doe on Unsplash — https://unsplash.com/@janedoe?utm_source=daily-insights&utm_medium=referral
Photo by John Smith on Pexels — https://www.pexels.com/photo/12345/
NASA / Public domain via Wikimedia Commons — https://commons.wikimedia.org/wiki/File:Example.jpg
```

## Constraints

- Write exactly one file: `caption.md` in the deck output folder.
- Total caption length ≤ 2,200 characters (Instagram body limit).
- Do not use emojis, icons, or decorative symbols.
- Preserve URL query strings exactly — do not strip UTM parameters from Unsplash URLs (required by their API guidelines).
