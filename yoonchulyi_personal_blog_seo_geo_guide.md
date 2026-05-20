# yoonchulyi.com 개인 블로그 SEO/GEO 가이드

작성일: 2026-05-19 KST  
대상 사이트: yoonchulyi.com  
범위: 개인 포트폴리오, 이력/프로젝트, 블로그, Daily Insights, AI 검색/GEO 대응

---

## 0. 결론

`yoonchulyi.com`은 일반적인 “개인 블로그”가 아니라 **개인 전문성 그래프(personal expertise graph)** 로 설계해야 한다.

검색엔진과 AI 검색엔진이 이해해야 할 핵심 문장은 다음이다.

> Yoonchul Yi is an AI product builder working on local-first productivity, AI-native notes, Claude Code workflows, and startup/product research.

현재 사이트는 홈이 매우 짧고, 실질적인 정보는 `About`, `Blog`, `Daily Insights`에 흩어져 있다. 이 구조에서는 사람도 AI도 “이 사람이 누구이고, 어떤 주제에 권위가 있는지”를 빠르게 결론내리기 어렵다.

따라서 우선순위는 다음이다.

1. **Home/About를 entity hub로 재작성한다.**
2. **프로젝트별 case study 페이지를 만든다.**
3. **Daily Insights를 단순 요약 저장소가 아니라 “Yoonchul의 관점이 누적되는 주제 그래프”로 바꾼다.**
4. **Blog는 high-conviction essay 중심으로 운영한다.**
5. **GEO는 별도 꼼수가 아니라 크롤링 가능성, 구조화 데이터, 자기 관점, 출처 그래프, AI bot 정책으로 구현한다.**

---

## 1. 현재 사이트 진단

### 1.1 관찰한 구조

검색 및 공개 페이지 기준 현재 구조는 다음에 가깝다.

- `/` 홈
- `/about/` 경험, 프로젝트, 외부 링크
- `/blog/` 블로그 인덱스
- `/blog/MaekNote-Manifesto/` 등 블로그 글
- `/daily-insights/` 날짜별 데일리 인사이트 인덱스
- `/daily-insights/YYYY/MM/DD/` 날짜별 다이제스트

### 1.2 강점

- 이미 개인 도메인을 사용하고 있다.
- About에 프로젝트와 정량 지표가 있다.
  - Notion template 66k+ downloads
  - Mynovel, MaekNote, Storybook4me 등 프로젝트 히스토리
  - RLWRLD, SNU Mechanical Engineering 등 배경
- Blog에 고유한 장문 글이 있다.
- Daily Insights는 빈도가 높고, AI/DevTools/Business 주제의 신호 수집량이 충분하다.
- 영어/한국어를 함께 다루고 있어 글로벌 검색과 한국 검색을 동시에 노릴 수 있다.

### 1.3 약점

- 홈의 정보량이 너무 적다.
  - “Hi, I'm Yoonchul Yi.”만으로는 검색엔진이 직업, 전문성, 주제, 프로젝트를 충분히 파악하기 어렵다.
- About은 이력과 프로젝트가 있지만, 상단 summary가 없다.
  - “AI product builder”, “local-first productivity”, “Claude Code workflow” 같은 정체성 문장이 필요하다.
- Blog 글 제목 중 일부는 검색 의도가 약하다.
  - 예: `Mutant`, `What I want to build`, `Why I want to go to US`
  - 감성적 제목은 좋지만 SEO title에는 검색 가능한 설명이 붙어야 한다.
- Daily Insights는 많지만 “요약 자동 생성 아카이브”로 보일 위험이 있다.
  - Google의 people-first content 기준에서는 단순 재가공보다 고유한 경험, 관점, 분석이 중요하다.
- 언어 구조가 혼합되어 있다.
  - 한 URL 안에 영어와 한국어가 같이 있으면 관리가 쉽지만, 언어별 검색 타겟팅은 약해질 수 있다.

---

## 2. 전략적 포지셔닝

### 2.1 개인 사이트의 목표

일반 블로그처럼 트래픽만 늘리는 것이 목표가 아니다. 이 사이트의 목적은 다음 세 가지다.

1. **Brand search 방어**
   - `Yoonchul Yi`, `이윤철`, `yoonchulyi`, `yiyoonchul` 검색 시 본인 사이트가 기준 출처가 되어야 한다.

2. **Expertise search 획득**
   - `Claude Code productivity workflow`
   - `local markdown AI notes`
   - `AI-native note app`
   - `Notion to Markdown migration`
   - `Korean AI startup builder`

3. **AI answer citation 획득**
   - ChatGPT, Claude, Perplexity, Google AI Overviews 등이 특정 주제에서 이 사이트를 참고할 수 있게 만들어야 한다.

### 2.2 핵심 카테고리

너무 넓게 잡으면 “개인 블로그”가 된다. 너무 좁게 잡으면 “MaekNote 홍보 페이지”가 된다. 중간 지점은 다음이다.

> AI-native productivity, local-first notes, Claude Code workflows, startup/product research.

이 네 가지가 사이트의 주제 축이다.

### 2.3 추천 자기소개 문장

홈 상단에 아래 정도의 문장이 필요하다.

```text
I'm Yoonchul Yi, an AI product builder based in Seoul. I build local-first productivity tools, write about Claude Code workflows and AI-native notes, and publish daily insights on AI, DevTools, and startups.
```

한국어 버전:

```text
이윤철은 서울 기반의 AI 제품 빌더입니다. 로컬 우선 생산성 도구와 AI 네이티브 노트 앱을 만들고, Claude Code 워크플로와 AI·DevTools·스타트업 인사이트를 기록합니다.
```

---

## 3. 정보 구조 개편안

### 3.1 권장 IA

```text
/
/about/
/resume/                  optional, or same as /about/
/projects/
/projects/maeknote/
/projects/mynovel/
/projects/storybook4me/
/projects/notion-templates/
/blog/
/blog/maeknote-manifesto/
/blog/claude-code-productivity-workflow/
/blog/notion-to-local-markdown-migration/
/daily-insights/
/daily-insights/2026/05/18/
/topics/
/topics/ai/
/topics/devtools/
/topics/productivity/
/topics/local-first/
/topics/startups/
/now/                      optional
/llms.txt                  optional for AI agents, not Google requirement
/sitemap.xml
/robots.txt
```

### 3.2 홈 역할

홈은 단순 링크 페이지가 아니라 다음을 15초 안에 답해야 한다.

- Who is Yoonchul Yi?
- What does he build?
- What does he write about?
- Why should I trust him?
- Where should I go next?

#### 홈 섹션 권장안

1. Hero
   - 이름, 한 줄 정체성, CTA
2. Current focus
   - MaekNote
   - Claude Code productivity
   - Daily AI/DevTools insights
3. Selected projects
   - MaekNote, Mynovel, Storybook4me, Notion Templates
4. Featured writing
   - MaekNote Manifesto
   - Claude Code workflow 글
   - Notion migration 글
5. Daily Insights preview
   - 최근 3개 + topic tags
6. Links
   - LinkedIn, GitHub, X, Threads, Substack 등

### 3.3 About 역할

About은 이력서와 프로젝트 목록을 합친 페이지가 아니라 **ProfilePage structured data의 기준 페이지**가 되어야 한다.

상단에 다음 정보를 명시한다.

```text
Yoonchul Yi
AI product builder · SNU Mechanical Engineering · Founder of MaekNote
Seoul, South Korea
Focus: local-first productivity, AI-native notes, Claude Code workflows, vertical AI software
```

그 아래:

- Experience
- Projects
- Writing themes
- Contact
- Social profiles

### 3.4 Project page 역할

외부 링크만 두면 검색엔진과 AI가 프로젝트의 맥락을 잃는다. 각 프로젝트는 내부 case study 페이지가 있어야 한다.

각 프로젝트 페이지 템플릿:

```text
H1: MaekNote
Subtitle: Local-first AI Markdown editor for Claude Code-style workflows.

Sections:
- What it is
- Why I built it
- Problem
- Product principles
- Technical architecture
- Current status
- What I learned
- Links
```

---

## 4. 페이지별 메타데이터 권장안

### 4.1 Home

```ts
export const metadata = {
  title: "Yoonchul Yi — AI Product Builder, MaekNote Founder",
  description:
    "Yoonchul Yi builds AI-native productivity tools and writes about local-first notes, Claude Code workflows, startups, and daily AI/devtools insights.",
  alternates: { canonical: "https://yoonchulyi.com/" },
}
```

### 4.2 About

```ts
export const metadata = {
  title: "About Yoonchul Yi — Projects, Experience, Resume",
  description:
    "Portfolio and resume of Yoonchul Yi: MaekNote, Mynovel, Storybook4me, Notion templates, AI product research, and SNU Mechanical Engineering.",
  alternates: { canonical: "https://yoonchulyi.com/about/" },
}
```

### 4.3 Blog index

```ts
export const metadata = {
  title: "Essays by Yoonchul Yi on AI, Productivity, Startups, and Notes",
  description:
    "Long-form essays by Yoonchul Yi on AI-native productivity, local-first notes, Claude Code workflows, startups, and personal operating systems.",
  alternates: { canonical: "https://yoonchulyi.com/blog/" },
}
```

### 4.4 Daily Insights index

```ts
export const metadata = {
  title: "Daily AI, DevTools, and Startup Insights — Yoonchul Yi",
  description:
    "Daily curated notes on AI, DevTools, productivity, startups, robotics, and vertical software by Yoonchul Yi.",
  alternates: { canonical: "https://yoonchulyi.com/daily-insights/" },
}
```

### 4.5 MaekNote Manifesto

현재 글 제목은 좋지만 SEO title은 더 설명적이어야 한다.

```ts
export const metadata = {
  title:
    "MaekNote Manifesto: Why I Left Notion for Local Markdown and Claude Code",
  description:
    "Why Yoonchul Yi left Notion, migrated to local Markdown files, and built MaekNote as a local-first context hub for Claude Code and AI agents.",
  alternates: { canonical: "https://yoonchulyi.com/blog/maeknote-manifesto/" },
}
```

기존 `/blog/MaekNote-Manifesto/`는 301 redirect로 lowercase slug에 연결한다.

---

## 5. 블로그 콘텐츠 전략

### 5.1 방향

블로그는 글 수가 많을 필요가 없다. 개인 사이트에서 중요한 것은 “이 사람이 왜 이 주제에 대해 말할 자격이 있는가”다.

Google의 people-first content 관점에서도 단순 요약, 검색어 맞춤 글, AI 생성 글 양산보다 고유한 경험과 관점이 중요하다.

### 5.2 Anchor essays 4개

초기 4개만 잘 만들어도 충분하다.

#### 1. MaekNote Manifesto 리라이트

기존 글을 유지하되 title, description, intro, headings를 검색 친화적으로 보강한다.

추천 제목:

```text
MaekNote Manifesto: Why I Left Notion for Local Markdown and Claude Code
```

상단 150단어 안에 반드시 들어갈 내용:

- Notion을 오래 썼다.
- Notion template 60k+ downloads 경험이 있다.
- Claude Code/Codex 때문에 생산성 워크플로를 재설계했다.
- local Markdown이 source of truth가 되어야 한다고 봤다.
- MaekNote를 그 문제를 풀기 위해 만들었다.

#### 2. Claude Code Productivity Workflow

추천 제목:

```text
How I Use Claude Code for Personal Productivity, Not Just Coding
```

검색 의도:

- Claude Code outside coding
- Claude Code productivity workflow
- Claude Code notes
- Claude Code personal OS

본문 구성:

- 기존 Notion workflow
- 문제: Notion + CLI agent의 단절
- local files로 전환
- folder structure
- skills / agents / handoff
- daily news automation
- study workflow
- writing workflow

#### 3. Notion to Local Markdown Migration

추천 제목:

```text
Why I Migrated My Notion Workspace to Local Markdown Files
```

검색 의도:

- Notion export Markdown
- Notion alternative local markdown
- local-first notes
- AI agents local files

#### 4. Daily Insights Pipeline

추천 제목:

```text
How I Curate Daily AI and DevTools Insights with Agents
```

이 글은 Daily Insights의 신뢰성을 높이는 설명서 역할을 한다.

본문 구성:

- 어떤 출처를 본다
- 어떻게 필터링한다
- 어떤 기준으로 요약한다
- 어떤 내용은 제외한다
- 왜 이 주제가 나에게 중요한가
- 자동화된 부분과 사람이 판단하는 부분

---

## 6. Daily Insights SEO 전략

### 6.1 현재 포지션

Daily Insights는 잠재적으로 가장 강한 콘텐츠 자산이다. 이유는 다음이다.

- 빈도가 높다.
- AI/DevTools/Business/Robotics 등 특정 관심사가 반복된다.
- 영어와 한국어가 모두 있다.
- 외부 출처 링크가 있다.
- 개인이 어떤 정보를 중요하게 보는지 드러난다.

하지만 이 자산은 잘못 운영하면 낮은 품질의 “자동 요약 아카이브”로 보일 수 있다.

### 6.2 색인 정책

모든 Daily page를 무조건 index하는 것은 위험하다. 기준을 정해야 한다.

#### index 허용

- 원문 요약 + 개인 해석이 있는 글
- “Why it matters”가 있는 글
- 특정 topic page에 연결되는 글
- 원문 출처가 명확한 글
- 제목이 단순 날짜가 아니라 주제도 포함하는 글

#### noindex 고려

- 링크 1~2개를 단순 요약한 글
- 개인 해석이 없는 글
- 자동 생성 흔적이 강하고 반복 구조만 있는 글
- 오래되어도 가치가 낮은 daily archive

실행안:

- 초기에는 모든 Daily Insights를 index한다.
- 30일 후 GSC에서 impressions/clicks가 없는 저품질 daily page를 선별한다.
- 얇은 daily page는 `noindex,follow` 처리하거나 weekly digest로 통합한다.

### 6.3 Daily page 템플릿

현재 구조:

```text
Daily Digest — 2026-05-18
2 items | AI, DevTools
Quick Summary
Detailed Notes
Korean translation
```

권장 구조:

```text
Daily Insights — 2026-05-18: AI Agents and Image-conditioned CAD

TL;DR
- 2~3 bullets

Yoonchul's Take
- 오늘 내가 중요하다고 본 이유
- MaekNote / AI-native productivity / startup 관점에서의 해석

Items
1. Source title
   - Source metadata
   - Summary
   - Why it matters
   - My note

Related topics
- AI agents
- DevTools
- CAD generation
- Claude Code workflows
```

### 6.4 Daily index 개선

현재 daily index는 날짜 목록 중심이다. 검색엔진과 사람에게는 정보 냄새가 약하다.

개선안:

```text
H1: Daily AI, DevTools, and Startup Insights
Intro: I collect and annotate signals from AI, DevTools, robotics, productivity, and vertical software.

Latest
- 2026-05-18 — AI agents, image-conditioned CAD
- 2026-05-15 — ...

Popular topics
- AI Agents
- DevTools
- Local-first productivity
- Robotics
- Vertical software

Monthly archives
- May 2026
- April 2026
```

### 6.5 Topic pages

Daily Insights의 SEO 가치는 날짜별 페이지보다 topic page에서 나온다.

추천 topic pages:

```text
/topics/ai-agents/
/topics/claude-code/
/topics/devtools/
/topics/vertical-software/
/topics/local-first-productivity/
/topics/robotics/
/topics/startups/
```

각 topic page 템플릿:

```text
H1: AI Agents
Intro: My notes and essays on AI agents, Claude Code workflows, and agentic productivity systems.

Featured essays
- How I Use Claude Code for Personal Productivity
- MaekNote Manifesto

Recent Daily Insights
- 2026-05-18 — 5-Agent Content Pipeline
- ...

Key ideas I track
- context separation
- agent handoff
- local files as source of truth
```

---

## 7. 언어 전략: English/Korean

### 7.1 현재 방식

현재 일부 페이지는 하나의 URL 안에 `En / Ko`가 있고, 영어 본문과 한국어 본문이 같이 있다.

장점:

- 관리가 쉽다.
- 양쪽 독자가 한 URL에서 읽을 수 있다.
- 링크 equity가 분산되지 않는다.

단점:

- 검색엔진이 페이지의 주 언어를 애매하게 볼 수 있다.
- 한국어 검색용 title/description과 영어 검색용 title/description을 동시에 최적화하기 어렵다.
- Naver 최적화에는 한국어 전용 URL이 더 명확하다.

### 7.2 추천안

#### v1: 현 구조 유지 + 언어 명확화

각 페이지에 다음을 추가한다.

```html
<html lang="en">
<section lang="en">...</section>
<section lang="ko">...</section>
```

Open Graph에는 기본 언어를 정한다.

```html
<meta property="og:locale" content="en_US" />
<meta property="og:locale:alternate" content="ko_KR" />
```

#### v2: 언어 분리

장기적으로는 다음 구조가 낫다.

```text
/en/blog/maeknote-manifesto/
/ko/blog/maeknote-manifesto/
```

각 페이지에 hreflang을 추가한다.

```html
<link rel="alternate" hreflang="en" href="https://yoonchulyi.com/en/blog/maeknote-manifesto/" />
<link rel="alternate" hreflang="ko" href="https://yoonchulyi.com/ko/blog/maeknote-manifesto/" />
<link rel="alternate" hreflang="x-default" href="https://yoonchulyi.com/blog/maeknote-manifesto/" />
```

### 7.3 현실적 결정

지금은 v1로 충분하다. 다만 Naver 노출을 진지하게 가져가려면 v2로 가야 한다.

---

## 8. Structured Data 전략

### 8.1 필수 타입

- `WebSite`
- `ProfilePage` + `Person`
- `BlogPosting` 또는 `Article`
- `BreadcrumbList`
- `ItemList` for blog/daily index

### 8.2 ProfilePage + Person 예시

```tsx
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": "https://yoonchulyi.com/about/#profile",
  "url": "https://yoonchulyi.com/about/",
  "name": "About Yoonchul Yi",
  "mainEntity": {
    "@type": "Person",
    "@id": "https://yoonchulyi.com/#person",
    "name": "Yoonchul Yi",
    "alternateName": ["이윤철", "yoonchulyi", "yiyoonchul", "YC"],
    "url": "https://yoonchulyi.com/",
    "jobTitle": "AI Product Builder",
    "homeLocation": {
      "@type": "Place",
      "name": "Seoul, South Korea"
    },
    "knowsAbout": [
      "AI-native productivity",
      "Local-first software",
      "Markdown notes",
      "Claude Code workflows",
      "Vertical AI software",
      "Startups",
      "Robotics"
    ],
    "sameAs": [
      "https://www.linkedin.com/in/ycyi",
      "https://github.com/...",
      "https://x.com/...",
      "https://www.threads.com/@yiyoonchul.note",
      "https://yoonchulnotes.substack.com/"
    ]
  }
}
```

주의: 실제 URL을 정확히 넣어야 한다.

### 8.3 BlogPosting 예시

```tsx
const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "@id": "https://yoonchulyi.com/blog/maeknote-manifesto/#article",
  "headline": "MaekNote Manifesto: Why I Left Notion for Local Markdown and Claude Code",
  "description": "Why Yoonchul Yi left Notion, migrated to local Markdown files, and built MaekNote as a context hub for Claude Code and AI agents.",
  "datePublished": "2026-05-18",
  "dateModified": "2026-05-19",
  "author": {
    "@id": "https://yoonchulyi.com/#person"
  },
  "publisher": {
    "@id": "https://yoonchulyi.com/#person"
  },
  "mainEntityOfPage": "https://yoonchulyi.com/blog/maeknote-manifesto/",
  "keywords": [
    "MaekNote",
    "Notion alternative",
    "Local Markdown",
    "Claude Code",
    "AI-native notes",
    "Local-first productivity"
  ]
}
```

### 8.4 Daily Insights Article 예시

Daily Insights는 `NewsArticle`보다 `BlogPosting` 또는 `Article`이 낫다. 정식 언론 뉴스가 아니라 개인 curated notes이기 때문이다.

```tsx
const dailyJsonLd = {
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "Daily Insights — 2026-05-18: AI Agents and Image-conditioned CAD",
  "datePublished": "2026-05-18",
  "dateModified": "2026-05-18",
  "author": { "@id": "https://yoonchulyi.com/#person" },
  "about": [
    { "@type": "Thing", "name": "AI agents" },
    { "@type": "Thing", "name": "DevTools" },
    { "@type": "Thing", "name": "CAD generation" }
  ],
  "citation": [
    "https://x.com/...",
    "https://gencad.github.io/..."
  ]
}
```

---

## 9. robots.txt, sitemap, AI crawler 정책

### 9.1 기본 원칙

개인 사이트는 공개 브랜딩 목적이므로 검색/AI 검색 노출을 막으면 안 된다. 다만 학습용 crawler는 선택적으로 차단할 수 있다.

추천 정책:

- 일반 검색엔진: 허용
- ChatGPT Search: 허용
- Claude search/user retrieval: 허용
- Perplexity search: 허용
- 모델 학습 crawler: 본인 철학에 따라 선택

개인 브랜딩이 목표라면 학습 crawler까지 전부 막을 필요는 없다. 하지만 공개 글이 모델 학습에 쓰이는 것이 싫다면 training crawler만 막고 search crawler는 허용한다.

### 9.2 robots.txt 예시

```txt
User-agent: *
Allow: /

Sitemap: https://yoonchulyi.com/sitemap.xml

# OpenAI: allow search visibility, optionally block training
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: GPTBot
Disallow: /

# Anthropic: allow search/user retrieval, optionally block training
User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: ClaudeBot
Disallow: /

# Perplexity: search index
User-agent: PerplexityBot
Allow: /
```

주의:

- `GPTBot Disallow`는 ChatGPT Search 노출 차단이 아니라 training opt-out 신호다.
- `OAI-SearchBot`을 막으면 ChatGPT search answers에 노출되지 않을 수 있다.
- Anthropic은 `ClaudeBot`, `Claude-User`, `Claude-SearchBot`을 구분한다.
- PerplexityBot은 검색엔진식 색인 역할에 가깝다고 설명한다.

### 9.3 sitemap.xml

사이트맵에는 다음을 포함한다.

```text
/
/about/
/projects/
/projects/maeknote/
/projects/mynovel/
/projects/storybook4me/
/projects/notion-templates/
/blog/
/blog/maeknote-manifesto/
/daily-insights/
/daily-insights/2026/05/18/
/topics/ai-agents/
/topics/devtools/
...
```

각 URL에는 `lastmod`를 넣는다.

### 9.4 llms.txt

Google용 SEO에는 필수 아님. Google은 AI 검색 노출을 위해 별도 `llms.txt`나 특수 AI markup이 필요 없다고 설명한다.

그러나 개인 사이트에서는 `llms.txt`가 실용적이다. 이유는 다음이다.

- AI agents가 사이트의 핵심 페이지를 빠르게 이해한다.
- 개인의 핵심 정체성, 프로젝트, 글, 주제 축을 한 파일에서 볼 수 있다.
- `yoonchulyi.com에 대해 요약해줘` 같은 user-directed retrieval에 도움이 될 수 있다.

예시:

```txt
# Yoonchul Yi

> Personal site of Yoonchul Yi, an AI product builder based in Seoul. He builds local-first productivity tools and writes about AI-native notes, Claude Code workflows, startups, and daily AI/devtools insights.

## Core pages

- [Home](https://yoonchulyi.com/): Overview of Yoonchul Yi, projects, writing, and links.
- [About](https://yoonchulyi.com/about/): Experience, projects, resume, and contact information.
- [Blog](https://yoonchulyi.com/blog/): Long-form essays on AI, productivity, startups, and notes.
- [Daily Insights](https://yoonchulyi.com/daily-insights/): Daily curated notes on AI, DevTools, productivity, startups, and robotics.

## Projects

- [MaekNote](https://yoonchulyi.com/projects/maeknote/): Local-first AI Markdown editor for Claude Code-style workflows.
- [Mynovel](https://yoonchulyi.com/projects/mynovel/): AI novel generation platform.
- [Storybook4me](https://yoonchulyi.com/projects/storybook4me/): Personalized AI storybook service.
- [Notion Templates](https://yoonchulyi.com/projects/notion-templates/): Notion templates with 66k+ downloads.

## Key writing

- [MaekNote Manifesto](https://yoonchulyi.com/blog/maeknote-manifesto/): Why Yoonchul left Notion for local Markdown and Claude Code workflows.

## Topics

- [AI agents](https://yoonchulyi.com/topics/ai-agents/)
- [Claude Code](https://yoonchulyi.com/topics/claude-code/)
- [Local-first productivity](https://yoonchulyi.com/topics/local-first-productivity/)
- [DevTools](https://yoonchulyi.com/topics/devtools/)
- [Vertical software](https://yoonchulyi.com/topics/vertical-software/)
```

---

## 10. Naver 대응

한국어 콘텐츠가 있으므로 Google만 보면 안 된다.

### 10.1 필수 작업

- Naver Search Advisor 등록
- 사이트 소유 확인
- sitemap 제출
- robots.txt 점검
- 한국어 title/description 보강
- canonical host 단일화

### 10.2 한국어 landing copy

한국어 사용자가 검색할 가능성이 있는 키워드:

- 이윤철
- 이윤철 블로그
- 이윤철 MaekNote
- 클로드 코드 생산성
- 노션 마크다운 이전
- AI 노트 앱
- 로컬 마크다운 노트
- 데일리 AI 인사이트

한국어 전용 소개 문장:

```text
이윤철은 AI 네이티브 생산성 도구를 만드는 빌더입니다. 로컬 마크다운 기반 노트 앱 MaekNote를 만들고 있으며, Claude Code 워크플로, 스타트업, DevTools, AI 에이전트에 대한 글과 데일리 인사이트를 기록합니다.
```

---

## 11. 코드베이스 도입 계획

Next.js App Router 기준. 다른 SSG/Astro/Gatsby면 파일명만 바꾸면 된다.

### 11.1 1차 PR: SEO foundation

목표: 검색엔진이 사이트를 제대로 읽게 만든다.

변경 파일:

```text
app/layout.tsx
app/sitemap.ts
app/robots.ts
lib/seo.ts
lib/schema.ts
public/og/default.png
```

작업:

- site-wide metadataBase 설정
- canonical 기본값 설정
- Open Graph/Twitter card 추가
- sitemap 자동 생성
- robots.txt 생성
- WebSite + Person JSON-LD 추가

### 11.2 2차 PR: Home/About entity rewrite

변경 파일:

```text
app/page.tsx
app/about/page.tsx
app/about/metadata.ts
components/ProfileSummary.tsx
components/ProjectCard.tsx
```

작업:

- Home hero 재작성
- About 상단 summary 추가
- project card에 내부 페이지 링크 추가
- sameAs 링크 정리
- ProfilePage JSON-LD 삽입

### 11.3 3차 PR: Blog/Daily metadata

변경 파일:

```text
app/blog/page.tsx
app/blog/[slug]/page.tsx
app/daily-insights/page.tsx
app/daily-insights/[year]/[month]/[day]/page.tsx
lib/content.ts
lib/article-schema.ts
```

작업:

- BlogPosting JSON-LD
- datePublished/dateModified
- author 연결
- tag/topic 연결
- daily page 제목 개선
- daily index 정보 냄새 강화

### 11.4 4차 PR: Topic pages

변경 파일:

```text
app/topics/page.tsx
app/topics/[slug]/page.tsx
content/topics/*.md
```

작업:

- topic taxonomy 정의
- blog/daily 글에 topic frontmatter 추가
- topic page에서 관련 글 자동 집계

### 11.5 5차 PR: llms.txt

변경 파일:

```text
public/llms.txt
```

작업:

- 핵심 페이지와 프로젝트만 큐레이션
- 매달 업데이트
- sitemap 대체물로 취급하지 않음

---

## 12. 콘텐츠 frontmatter 표준

### 12.1 Blog

```yaml
title: "MaekNote Manifesto: Why I Left Notion for Local Markdown and Claude Code"
seoTitle: "MaekNote Manifesto: Why I Left Notion for Local Markdown and Claude Code"
description: "Why Yoonchul Yi left Notion, migrated to local Markdown files, and built MaekNote as a context hub for Claude Code and AI agents."
slug: "maeknote-manifesto"
datePublished: "2026-05-18"
dateModified: "2026-05-19"
language: "en"
alternateLanguages:
  ko: "/ko/blog/maeknote-manifesto/"
tags:
  - MaekNote
  - Claude Code
  - Local Markdown
  - Notion
  - AI-native productivity
topics:
  - local-first-productivity
  - claude-code
  - ai-notes
featured: true
index: true
```

### 12.2 Daily Insights

```yaml
title: "Daily Insights — 2026-05-18: AI Agents and Image-conditioned CAD"
description: "Notes on a 5-agent Claude content pipeline and GenCAD, an image-conditioned CAD generation project."
datePublished: "2026-05-18"
dateModified: "2026-05-18"
tags:
  - AI
  - DevTools
  - CAD
topics:
  - ai-agents
  - devtools
  - cad-generation
sources:
  - title: "5-Agent Content Pipeline That Replaces a $300K Creative Team"
    url: "https://x.com/..."
    author: "Rahul"
  - title: "GenCAD"
    url: "https://gencad.github.io/..."
index: true
hasOriginalTake: true
```

---

## 13. 내부 링크 전략

### 13.1 Blog → Project

MaekNote 관련 글에서는 반드시 내부 project page로 링크한다.

```text
MaekNote is my local-first AI Markdown editor for Claude Code-style workflows.
```

`MaekNote` 텍스트를 `/projects/maeknote/`에 링크.

### 13.2 Daily → Topic

Daily page의 각 item 아래 관련 topic 링크를 둔다.

```text
Related: AI agents, Claude Code, DevTools
```

### 13.3 Topic → Blog/Daily

Topic page는 blog와 daily를 연결하는 허브다.

예:

`/topics/claude-code/`에는 다음이 보여야 한다.

- MaekNote Manifesto
- Claude Code productivity workflow
- Daily Insights 중 Claude 관련 글
- 관련 프로젝트: MaekNote

---

## 14. GEO 체크리스트

### 14.1 AI가 인용하기 좋은 페이지의 조건

- 첫 100단어 안에 페이지의 정체가 명확하다.
- 작성자가 누구인지 명확하다.
- 왜 이 작성자가 해당 주제에 대해 말할 자격이 있는지 명확하다.
- 외부 출처가 명확하다.
- 내부 관련 페이지가 연결되어 있다.
- 날짜와 업데이트 시간이 있다.
- title과 H1이 검색 의도를 담고 있다.
- 같은 내용이 여러 URL에 흩어져 있지 않다.

### 14.2 개인 사이트용 GEO 패턴

각 핵심 페이지에 다음 블록을 넣는다.

```text
Context
This page is written by Yoonchul Yi, an AI product builder working on local-first productivity tools and Claude Code workflows.

Why this matters
...

Related work
- MaekNote
- Daily Insights
- Claude Code productivity workflow
```

AI 검색은 사람이 보기에 자연스러운 구조를 잘 읽는다. 숨겨진 키워드보다 명확한 문맥이 중요하다.

---

## 15. 측정 계획

### 15.1 Google Search Console

추적할 query group:

```text
Brand
- yoonchul yi
- yoonchulyi
- yiyoonchul
- 이윤철

Project
- maeknote
- maeknote manifesto
- maeknote app

Topic
- claude code productivity
- claude code notes
- local markdown ai notes
- notion to markdown migration
- ai native note app
- daily ai insights
```

측정 지표:

- indexed pages
- impressions
- clicks
- CTR
- average position
- query diversity
- page별 impressions

### 15.2 Naver Search Advisor

추적:

- 사이트 수집 성공 여부
- sitemap 인식 여부
- robots 오류
- 한국어 query 노출

### 15.3 Server logs

AI bot user-agent 추적:

```text
OAI-SearchBot
ChatGPT-User
GPTBot
ClaudeBot
Claude-User
Claude-SearchBot
PerplexityBot
Googlebot
Yeti
```

목표:

- AI search crawler가 핵심 페이지를 읽는지 확인
- Daily archive만 과하게 긁고 핵심 page는 안 읽는지 확인
- crawler가 막혀 있지 않은지 확인

---

## 16. 30일 실행 로드맵

### Week 1

- Home/About rewrite
- site-wide metadata 정리
- canonical 설정
- sitemap/robots 확인
- ProfilePage + Person JSON-LD 추가

### Week 2

- MaekNote Manifesto SEO rewrite
- slug lowercase redirect
- BlogPosting JSON-LD 추가
- OG image 추가

### Week 3

- Daily Insights template 개선
- `Yoonchul's Take` 추가
- topic tags 추가
- Daily index 개선

### Week 4

- Topic pages 출시
- llms.txt 추가
- GSC/Naver 제출
- AI bot logs 확인

---

## 17. 하지 말아야 할 것

- Daily Insights를 AI 요약으로만 대량 생산하지 말 것.
- 모든 글 제목을 감성적 제목으로만 두지 말 것.
- 영어/한국어를 무계획으로 섞지 말 것.
- 모든 AI bot을 무차별 차단하지 말 것.
- `llms.txt`를 SEO 치트키로 착각하지 말 것.
- 프로젝트를 외부 링크만으로 처리하지 말 것.
- 포트폴리오를 이력 나열로 끝내지 말 것.

---

## 18. 참고 자료

- Google Search Central — Optimizing your website for generative AI features on Google Search  
  https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google Search Central — Creating helpful, reliable, people-first content  
  https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google Search Central — ProfilePage structured data  
  https://developers.google.com/search/docs/appearance/structured-data/profile-page
- Google Search Central — Article structured data  
  https://developers.google.com/search/docs/appearance/structured-data/article
- Google Search Central — Meta descriptions/snippets  
  https://developers.google.com/search/docs/appearance/snippet
- Google Search Central — Canonicalization  
  https://developers.google.com/search/docs/crawling-indexing/canonicalization
- Naver Search Advisor — 웹 사이트를 만들 때  
  https://searchadvisor.naver.com/guide/seo-basic-create
- Naver Search Advisor — robots.txt 설정하기  
  https://searchadvisor.naver.com/guide/seo-basic-robots
- OpenAI — Overview of OpenAI Crawlers  
  https://developers.openai.com/api/docs/bots
- Anthropic Privacy Center — Does Anthropic crawl data from the web?  
  https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- Perplexity Help Center — How does Perplexity follow robots.txt?  
  https://www.perplexity.ai/help-center/en/articles/10354969-how-does-perplexity-follow-robots-txt
- llms.txt proposal  
  https://llmstxt.org/
