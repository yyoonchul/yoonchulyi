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

1. **English only.** Stock photo APIs (Unsplash, Pexels, Wikimedia) index English best.
2. **2–4 words.** Longer queries match fewer photos. Drop articles/verbs; keep concrete nouns.
3. **Concrete over abstract.** Prefer `data center servers` over `cloud computing`; `chip wafer` over `semiconductor industry`.
4. **Avoid named individuals.** Don't query `"Sam Altman"`. Generalize to `openai office`, `tech executive speaking`, etc. — stock APIs rarely have public figures and Pexels prohibits using identifiable persons in ways that imply endorsement.
5. **Avoid company logos/trademarks as the sole subject.** Use the physical/visual metaphor instead (`ai chip`, `server rack`, `startup workspace`).
6. **If the article is critical or negative in tone**, append `abstract` or `landscape` to steer away from identifiable people (Pexels license restriction on negative portrayal).
7. **Fallback query**: if the article is highly abstract (e.g. governance/policy), use a visual metaphor like `blueprint architecture`, `glass building`, `open book`.

## Deriving the query

For each article, base the query on:
- The article **title** (strip Korean particles, extract the core noun phrase).
- The first **bullet** if the title is too generic.
- The **category** as a disambiguator.

For the cover, combine the first 1–2 `categories` from the `> N건 정리 | ...` line into a single scene.

## Examples

| Article title (KO) | Category | Query |
|---|---|---|
| 오픈AI, 새로운 추론 모델 공개 | AI Models | `openai office laboratory` |
| 엔비디아 H200 데이터센터 수요 폭증 | AI Infrastructure | `nvidia data center gpu` |
| 머스크의 xAI, 120억 달러 추가 유치 | Funding | `startup funding meeting` (not "Elon Musk") |
| 애플 비전프로 판매 부진 | Consumer Tech | `vr headset showroom` |
| EU AI법 시행 지연 | Policy | `european parliament building` |

## Constraints

- Do not output anything other than the JSON object.
- Do not include markdown code fences in the saved file.
- Keep the array length equal to the article count exactly — the renderer maps by index.
