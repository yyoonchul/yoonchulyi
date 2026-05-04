# Header Generation (per-bullet + main cover title)

Produce the Korean headers used by the card-news renderer.

## Output shape

One JSON object written to `meta/card-news/headers/YYYY/MM/DD.json`:

```json
{
  "articles": [
    ["기사 1 - 불렛 1 헤더", "기사 1 - 불렛 2 헤더", "기사 1 - 불렛 3 헤더"],
    ["기사 2 - 불렛 1 헤더", "기사 2 - 불렛 2 헤더"]
  ],
  "cover": [
    "오늘의 메인 제목"
  ]
}
```

- `articles[i]`: array of headers, **one per bullet** of article *i*, in the digest's bullet order. Length must equal that article's bullet count exactly. Each header is the **page header** for that bullet's content slide.
- `cover`: array containing exactly **one main title** for the whole day's deck. The cover is not a collection of article-level summaries.

## Hard constraints (the renderer cannot fix overflow)

Header font is laid out on a 1080px-wide canvas with side padding 80. With letter-spacing `-1`, **only ~13 CJK characters fit on one line** at the per-page header size. Spaces and punctuation count. No emoji.

- **Each `articles[i][j]` ≤ 13 characters** (Korean syllable count).
- **`cover[0]` should be concise and attention-grabbing, ideally 12–22 Korean characters before wrapping.** The cover template auto-wraps and auto-shrinks, but long titles lose impact.
- Use at most one comma or break-like punctuation in `cover[0]`; no emoji and no quotes.

Count characters yourself before writing — anything longer will visually clip.

## Step 1 — Per-bullet headers (`articles[i][j]`)

Generate **first**. For each bullet of each article, write a short Korean header that summarises **that specific bullet** (not the article).

Style:

- Plain declarative noun phrase, not a full sentence.
- Strong nouns + minimal modifier. Cut adjectives, hedge words, possessive `～의 ～`.
- Keep one concrete signal per header: a company, a product, a number, an action, a mechanism.
- **Each bullet on the same article must get a clearly different header** — they should distinguish the three (or N) angles of the article, not paraphrase the article title three times.
- No emoji, no quotes, no leading bullets.

Example (3 bullets of the same article, all distinct):

| Bullet content (paraphrased) | ✓ Page header |
|---|---|
| Stella 비서가 인간 비서를 대체했다는 주장 | `Stella, 인간 비서 대체` (12) |
| 마크다운 메모리 두 층이 핵심 구조 | `마크다운 메모리 두 층` (10) |
| 주간 개선 루프가 진짜 차별점 | `주간 개선 루프가 핵심` (11) |

## Step 2 — Main cover title (`cover[0]`)

Generate **after** all per-bullet headers are settled. Read the full set of today's article titles and bullets, then write **one Korean main title** that captures the day's most important signal.

This is an editorial judgment task. Do **not** concatenate article summaries. Instead, identify one of these:

- A shared theme across multiple articles.
- The highest-impact single story if one item clearly dominates the day.
- A tension or shift that makes the reader curious.

Style:

- Short, punchy Korean headline. Prefer 12–22 Korean characters.
- Concrete enough to signal today's content, but broad enough to cover the deck.
- Curiosity-forward, not clickbait. Make the reader feel "I should see what changed."
- Prefer strong nouns and active shifts: `AI`, `반도체`, `빅테크`, `전력`, `규제`, `채용`, `가격`, `속도`, `경쟁`, `전환`.
- Avoid bland labels like `오늘의 테크 뉴스`, article-title mashups, source names with no angle, and generic category lists.
- Do not restate any bullet header verbatim.
- Avoid reusing the same cover-title grammar across days. Do not default to `X가 Y를 바꾼다`, `X의 판이 바뀐다`, or `X가 다시 쓴다` unless it is clearly the strongest fit.

Cover title pattern bank:

| Pattern | Use when | Example |
|---|---|---|
| `무엇이 흔들린다` | market power, trust, rules, or assumptions are weakening | `AI 신뢰가 흔들린다` |
| `무엇이 빨라진다` | speed, adoption, automation, or competition is the main signal | `자동화 경쟁이 빨라진다` |
| `무엇의 기준이 바뀐다` | evaluation, pricing, hiring, design, or policy standards shift | `개발 도구의 기준이 바뀐다` |
| `무엇이 어디로 간다` | capital, talent, users, or compute moves to a new place | `자본이 AI 인프라로 간다` |
| `누가 무엇을 좁힌다` | a gap closes between competitors or technologies | `오픈소스가 격차를 좁힌다` |
| `무엇이 비용이 된다` | hidden cost, energy, data, security, or regulation becomes central | `보안이 AI의 비용이 된다` |
| `무엇이 실험을 넘는다` | prototypes become products, workflows, or infrastructure | `AI 에이전트가 실험을 넘는다` |
| `무엇은 커지고, 무엇은 작아진다` | two forces move in opposite directions | `모델은 커지고, 팀은 작아진다` |
| `무엇의 다음 전장` | a new competitive arena is emerging | `AI 검색의 다음 전장` |
| `무엇을 다시 묻는다` | the day is about a renewed debate or unresolved question | `오픈소스를 다시 묻는다` |

Examples:

```json
{
  "cover": ["AI가 일하는 방식을 다시 쓴다"]
}
```

```json
{
  "cover": ["빅테크 경쟁의 판이 바뀐다"]
}
```

More varied examples:

```json
{
  "cover": ["AI 신뢰가 흔들린다"]
}
```

```json
{
  "cover": ["자동화 경쟁이 빨라진다"]
}
```

```json
{
  "cover": ["보안이 AI의 비용이 된다"]
}
```

```json
{
  "cover": ["모델은 커지고, 팀은 작아진다"]
}
```

## Constraints

- Output only the JSON object — no markdown fences, no commentary.
- `articles.length` must equal the digest article count exactly.
- `articles[i].length` must equal article *i*'s bullet count exactly.
- `cover.length` must equal **1**.
- All entries are non-empty strings.
