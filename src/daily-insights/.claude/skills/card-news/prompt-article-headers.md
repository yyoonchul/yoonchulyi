# Article Header Generation

Produce one Korean cover title, one source/original-title line, and one Korean content-page header per detailed section for the article-card renderer.

## Output shape

Write one JSON object to `card-news/article-headers/YYYY/MM/DD.json`:

```json
{
  "articles": [
    {
      "cover": "소형 모델의 속도 역전",
      "source": "0xmmo의 \"Small Model Forensics\"",
      "sections": [
        "제공사별 지연 차이",
        "프리필 곡선의 반전"
      ]
    },
    {
      "cover": "AI 시대의 사고 검증",
      "source": "Will Hackett의 \"How do you tell who's thinking?\"",
      "sections": [
        "산출물이 숨긴 사고",
        "마찰이라는 신호"
      ]
    }
  ]
}
```

- `articles[i].cover` is the cover title for article *i* in digest order.
- `articles[i].source` is the orange original-title line for the cover.
- `articles[i].sections[j]` is the content-page header for the *j*th top-level numbered item under that article's `## 📝 상세 정리`.

## Rules

- Korean framing text only, except the exact original title inside `source` may remain in its original language.
- When naming or referring to people, use the person's name, public handle, role title, or organization label instead of gendered pronouns. Avoid `그`, `그녀`, `he`, `she`, `him`, and `her` unless they are part of the exact original title.
- Cover title: prefer 10-20 Korean characters. Summarize the article's main signal, not the whole day's theme.
- Source line:
  - Must include the original title from the digest exactly, wrapped in straight double quotes.
  - Add a short modifier around the quoted title that names the source, author, format, or public figure when available.
  - Prefer patterns like `TechCrunch 기사 "..."`, `GitHub 레포 "..."`, `논문 "..."`, `Will Hackett의 "..."`, `Richard Socher 인터뷰 기사 "..."`.
  - If both source and author exist, prefer the more recognizable one. For famous people, use the person's name. For publications, use the site name. For repositories or papers, name the format.
  - Keep it concise enough for a small orange cover line; one line is ideal, two lines acceptable.
- Section header: derive it from the numbered item's main title, shortening it to fit the card header. Prefer 8-16 Korean characters.
- No emoji or generic labels.
- The "No quotes" rule does not apply to `source`; `source` must use double quotes around the exact original title.
- Keep each title concrete enough to stand alone.
- Do not summarize or rewrite the detailed body bullets. The renderer uses those details verbatim from the digest.
- Keep each `sections` array length exactly equal to the number of top-level numbered detail items for that article.

Output only the JSON object.
