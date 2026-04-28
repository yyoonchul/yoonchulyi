# Image Query Generation

Produce English stock-photo search queries for one card news deck.

## Output shape

One JSON object written to `meta/card-news/queries/YYYY/MM/DD.json`:

```json
{
  "cover": "AI semiconductor factory",
  "articles": [
    "OpenAI office headquarters",
    "data center cooling",
    "autonomous vehicle road"
  ]
}
```

- `cover`: 1 query (2–4 English words) — derived from the deck's categories.
- `articles`: one query per article in the digest, in the same order as the KO `## 📋 간단 요약` section.

## Rules for each query

1. **English only.** Stock photo APIs index English best.
2. **2–4 words.** Drop articles/verbs; keep concrete nouns.
3. **Concrete over abstract.** Prefer `data center servers` over `cloud computing`.
4. **Avoid named individuals.** Generalize (`tech executive speaking` instead of a specific name). Pexels prohibits uses of identifiable persons that imply endorsement.
5. **Avoid company logos/trademarks as the sole subject.** Use a visual metaphor (`ai chip`, `server rack`, `startup workspace`).
6. **If article tone is critical/negative**, append `abstract` or `landscape` to avoid identifiable people.
7. **Highly abstract topics** (policy, governance): use visual metaphors (`blueprint architecture`, `glass building`, `open book`).

## Deriving the query

For each article:

- Start from the **title**. Strip Korean particles, extract the core noun phrase.
- If title is too generic, pull from the **first bullet**.
- Use the **category** as a disambiguator when needed.

For the cover, combine the first 1–2 `categories` from the `> N건 정리 | ...` line into one scene.

## Examples

| Article title (KO) | Category | Query |
|---|---|---|
| 오픈AI, 새로운 추론 모델 공개 | AI Models | `openai office laboratory` |
| 엔비디아 H200 데이터센터 수요 폭증 | AI Infrastructure | `nvidia data center gpu` |
| 머스크의 xAI, 120억 달러 추가 유치 | Funding | `startup funding meeting` |
| 애플 비전프로 판매 부진 | Consumer Tech | `vr headset showroom` |
| EU AI법 시행 지연 | Policy | `european parliament building` |

## Constraints

- Output nothing but the JSON object (no code fences in the saved file).
- The `articles` array length must equal the article count exactly — the renderer maps by index.
