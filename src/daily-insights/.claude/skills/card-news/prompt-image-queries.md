# Image Query Generation

Produce English image search queries for article-level card news decks.

## Output shape

One JSON object written to `card-news/queries/YYYY/MM/DD.json`:

```json
{
  "cover": "AI",
  "articles": [
    {
      "cover": "Google Gemini",
      "sections": [
        "OpenAI",
        "Gemini 3.1 Flash Lite"
      ]
    },
    {
      "cover": "Will Hackett",
      "sections": [
        "METR",
        "McKinsey"
      ]
    }
  ]
}
```

- `cover`: 1 query — prefer one salient proper noun from the whole digest; otherwise a general 2-4 word fallback.
- `articles`: one object per article in the digest, in the same order as the KO `## 📋 간단 요약` section.
- `articles[i].cover`: one cover image query for article *i*.
- `articles[i].sections[j]`: one image query for the *j*th top-level numbered detail item under article *i*. Each content page uses one image, so every section needs its own concrete query.

## Rules for each query

1. **English only.** The resolver searches Wikimedia, Openverse, NASA Images, Unsplash, and Pexels; English indexes best across all of them.
2. **Proper noun first.** If the card contains a salient company, product, person, organization, publication, repository, paper, place, city, country, institution, dataset, model, protocol, or named object, use that as the query.
3. **Prefer exactly one named entity.** Use one proper noun or official proper-noun phrase: `OpenAI`, `Anthropic`, `Google Gemini`, `TechCrunch`, `Richard Socher`, `San Francisco`, `ImageNet`, `Recursive Superintelligence`. Do not add generic words like `office`, `logo`, `portrait`, `news`, or `article`.
4. **Disambiguate ambiguous names with the official owner only.** If a one-word name also means something else, use the official entity phrase: `Google Gemini` instead of `Gemini`, `Apple Vision Pro` instead of `Vision Pro`.
5. **Choose the most visual and central proper noun.** Prefer the named entity the card wants readers to remember, not incidental names. For a section comparing providers, choose the provider/model most emphasized in that section.
6. **Avoid repeated queries within the same article deck.** If the same entity would appear on multiple cards, vary the query with the next most specific named entity or official variant from that card: `Google Gemini`, `Gemini 3.1 Flash Lite`, `GPT-4.1 Nano`, `OpenAI`, `Anthropic`. Use exact repeats only when the card has no other meaningful named entity.
7. **Prefer image-friendly specificity.** Model/product names with official owners often work better than bare words: `Google Gemini`, `Apple Vision Pro`, `OpenAI Codex`, `Ramp AI Index`.
8. **Fallback only when no useful proper noun exists.** Then use a concrete general query of 2-4 English words: `data center servers`, `chip wafer`, `whiteboard system design`, `market share chart`.
9. **Use general queries for risky negative portrayals of private individuals.** Public figures, companies, publications, models, places, and organizations are allowed as queries; if the only proper noun is a non-public individual in a negative context, fallback to the concrete scene.
10. **Avoid descriptive sentence fragments.** Output a search term, not a caption.
11. **No person pronouns.** If a query needs a person, use the person's name, public handle, role title, or organization label; never use `he`, `she`, `him`, or `her`.

## Deriving the query

For each article, base the query on:
- First scan the article title, source line, author, category, and summary bullets for proper nouns.
- Pick the strongest single named entity for the cover query.
- If no proper noun is visually useful, use the most concrete object/scene from the first summary bullet.

For each section, base the query on:
- First scan the numbered detail item's title and indented detail bullets for proper nouns.
- Pick one named entity that best represents that section.
- Before finalizing, scan the article deck's other queries and replace repeated queries with a more specific or adjacent named entity from that same section when possible.
- If there is no useful named entity, use the most concrete object/scene in that section.

For the daily cover fallback, scan all article titles, sources, authors, and categories for the most important named entity. If no single entity represents the day, use the first 1-2 categories as a concrete scene.

## Constraints

- Do not output anything other than the JSON object.
- Do not include markdown code fences in the saved file.
- Keep the article array length equal to the article count exactly.
- Keep each `sections` array length equal to that article's top-level numbered detail item count exactly.
