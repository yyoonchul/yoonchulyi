# Bilingual Daily Digest Template

Use this exact fixed structure.

```md
<!-- LANG:EN:START -->
# 📰 Daily Digest — YYYY-MM-DD

> N items | Category1, Category2, ...

---

## 📋 Quick Summary

### {Article Title 1}
**Source:** {Source} · **Category:** {Category} · **Link:** [Original]({URL})
- Bullet 1
- Bullet 2
- Bullet 3

### {Article Title 2}
**Source:** {Source} · **Category:** {Category} · **Link:** [Original]({URL})
- Bullet 1
- Bullet 2
- Bullet 3

(...)

---

## 📝 Detailed Notes

### 1. {Article Title 1}

1. {Major point 1}
   - {Detail bullet A}
   - {Detail bullet B}
   - {Detail bullet C}
2. {Major point 2}
   - {Detail bullet A}
   - {Detail bullet B}
   - {Detail bullet C}
(...)

---

### 2. {Article Title 2}

1. {Major point 1}
   - {Detail bullet A}
   - {Detail bullet B}
   - {Detail bullet C}
2. {Major point 2}
   - {Detail bullet A}
   - {Detail bullet B}
   - {Detail bullet C}
(...)

(...)
<!-- LANG:EN:END -->

<!-- LANG:KO:START -->
# 📰 데일리 다이제스트 — YYYY-MM-DD

> N건 정리 | 카테고리1, 카테고리2, ...

---

## 📋 간단 요약

### {글 제목 1}
**출처:** {출처} · **카테고리:** {카테고리} · **링크:** [원문]({URL})
- 불렛 1
- 불렛 2
- 불렛 3

### {글 제목 2}
**출처:** {출처} · **카테고리:** {카테고리} · **링크:** [원문]({URL})
- 불렛 1
- 불렛 2
- 불렛 3

(...)

---

## 📝 상세 정리

### 1. {글 제목 1}

1. {핵심 포인트 1}
   - {디테일 불렛 A}
   - {디테일 불렛 B}
   - {디테일 불렛 C}
2. {핵심 포인트 2}
   - {디테일 불렛 A}
   - {디테일 불렛 B}
   - {디테일 불렛 C}
(...)

---

### 2. {글 제목 2}

1. {핵심 포인트 1}
   - {디테일 불렛 A}
   - {디테일 불렛 B}
   - {디테일 불렛 C}
2. {핵심 포인트 2}
   - {디테일 불렛 A}
   - {디테일 불렛 B}
   - {디테일 불렛 C}
(...)

(...)
<!-- LANG:KO:END -->
```

## Hard Rules

- EN section first, KO section second.
- Marker strings must match exactly.
- Article order must match between EN and KO sections.
- Do not include content outside the marker blocks.
