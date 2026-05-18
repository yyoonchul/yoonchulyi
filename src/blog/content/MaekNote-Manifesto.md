---
title: MaekNote Manifesto
date: 2026-05-18
---

<!-- LANG:EN:START -->

## Introduction

Five years ago, when I was a freshman in college, a friend introduced me to Notion. Since then, almost every record and workspace in my life has passed through Notion. It was like a second operating system on top of Windows and macOS: the place that held all my context, the starting point for nearly all my work, and the archive where everything eventually ended up.

I loved Notion that much. I even made Notion templates myself, published them on the marketplace, recorded more than 60,000 downloads, and made a few hundred dollars from them. Through that process, I used Notion inside out.

Then last month, I finally left Notion completely.

I migrated every record and piece of context I had in Notion into local Markdown files. In the process, I ended up building my own note app so that local Markdown files could feel as usable as Notion. The goal was simple: to unify all of my productivity around CLI tools like Claude Code and Codex, and to make all of my context available to CLI agents.

In this post, I want to write about why I made that decision, why I had to build a new app for it, how I am using it now, and how I plan to build and use it going forward.

---

## The Shift Beyond the Tool

I did not leave Notion because I was dissatisfied with it. If anything, it was because I had used Notion for so long and so deeply that I became convinced of the opposite: in the age of AI agents, all of my context should not be locked inside one app, in that app's proprietary format.

While using CLI agent tools like Claude Code and Codex, I saw the possibility of a general-purpose execution system, something closer to Jarvis from the movies than to a mere coding tool. To use that possibility properly, my records and workflows needed to live somewhere agents could easily access, in a format that was always available and readable by anyone.

From late last year into early this year, I began using Claude Code[^1] seriously. It felt different from the AI tools I had used before, and I began to feel that I should redesign my entire productivity workflow around it. I had already seen a few examples of people using Claude Code for productivity work outside of coding. Around the time of Opus 4.5 and 4.6, even developers who had been skeptical of agentic coding seemed to be admitting that the era had changed. Around then, I also began thinking that I should use Claude Code more actively[^2], and bring it into the rest of my productivity work. There were moments when Claude Code felt like it had crossed a real threshold, and I had already been thinking that this was probably the right direction for interacting with AI tools.[^3]

From that perspective, the core of Claude Code is not only the capability of a model like Opus, but the agentic system that runs on top of it. If the models powering that system keep improving[^4], then replacing the final task from coding to something else does not seem unreasonable at all. Especially in a system like Notion, which is fundamentally based on Markdown-like text documents, reading, writing, and editing documents should be natural if we treat code as just one kind of text.

So I tried it. I opened my blog posts, references I wanted to organize, and writing from other platforms inside Cursor IDE, then used Claude Code to summarize and draft documents. Watching it interpret existing materials and generate the documents I needed, much like it would inspect a codebase and then edit or create code based on my request, made me think: this is the future of using AI.

In the far future, I think artificial general intelligence[^5] will handle in one place the work we currently spread across many tools and AI services.[^6] The closest thing I have felt so far to that future Jarvis experience was doing productivity work through Claude Code.

So I decided to do all of my productivity work with Claude Code, and immediately saw the biggest bottleneck. Until then, I had recorded everything in Notion. My daily to-do lists were in Notion, every new project began with a Notion page, and the archive for those projects was also Notion.

But Notion and Claude Code were not a great match. MCP and the official API did not feel like working with a local repo. That made me feel the need for a local file-based tool that could serve as the central hub for my productivity, the way Notion had, while still being accessible to Claude Code. Of course, I tried Notion AI too[^7], but once tasks became large, the performance was not satisfying.[^8]

Even if that performance improves, I do not know when another agent or tool will become better. I wanted a system where my context and interface could stay the same, while I could attach any AI agent to it at any time. My poor experience exporting data from Notion also played a role. AI tools are in an extremely competitive race. Rather than packing up and moving every time the leader changes, I decided it made more sense to build my own house, furnish it the way I like, and invite AI in as the butler.

In short, I needed an interface that was friendly to multiple AI agents while still being pleasant for humans to use, like Notion.

---

## MaekNote, a Hub for Context

That is why I built MaekNote. It is less an app that provides AI intelligence itself and more an interface that lets any agent attach itself to my local context. It keeps the human experience of comfortably reading and writing, like Notion, but places the source of truth in local Markdown files. Beside those files, general-purpose agents like Claude Code or Codex can directly read and edit my materials.

For me, MaekNote is not just a note app. It is a local context OS for rebuilding my entire personal productivity workflow around agents.

Was I the first person to feel these inconveniences? Of course not. Others had already felt similar friction, and Obsidian plus Claude Code seemed to be treated as a fairly standard answer. I considered trying Obsidian too, but I thought recreating a Notion-like experience through a plugin ecosystem would come with too much setup cost. In an era like this, I found myself thinking: in the time it takes to get used to that, I could build exactly what I want.

More importantly, neither Notion nor Obsidian was born in the AI era. They are products adapting to the AI era. As someone interested in this category, I felt that an AI-native tool born in the AI era needed to exist. As I will explain later, MaekNote is grounded in the question: what should notes look like in the AI era? The features it has now, and the features it will have later, come from that question.

Through that line of thinking, the product concept changed several times. The concept that finally settled in v1 was this:

> Recreate the Notion experience as much as possible on top of local Markdown files, and attach a terminal on the side so Claude Code can be used there.

I implemented Notion's core experiences, Markdown-based notes and databases, while strictly keeping local Markdown files as the source of truth. The goal was to make the whole workspace usable with Claude Code, like a co-pilot.[^9] I had ideas such as serving a local LLM or automatically building our own context map, but after clarifying the philosophy below, the current spec became the right first version.

First, keep the source of truth as transparent and universal as possible, and minimize formats that exist only for our app or only for one specific app. Our notes should open in Obsidian, and workflows created in our app should remain valid no matter what editor and agent combination someone uses, whether Cursor, VS Code, Claude Code, Codex, or something else. Data exported from Notion failed to preserve almost all of its original utility. In v1, I did not want to overfit users' workflows to MaekNote. From a strategic point of view, adding some proprietary elements might eventually make sense, but they did not fit the initial philosophy, so I left them out.

Second, we do not provide the intelligence. Rather than competing with companies like OpenAI or Anthropic[^10], I wanted to think about where we can provide the most value when a few major providers eventually build Jarvis-like intelligence and dominate the world. The intelligence can come entirely from big tech providers. Our role is to preserve the user's data and context under the same interface, even if they switch between providers at any time. If multiple companies build their own Jarvis, we should provide the interface that lets people use them together or interchangeably. That philosophy shaped the long-term vision of the app.

That is how the current spec emerged. It is built around a Markdown editor. Notes with YAML headers become individual records in a database.[^11] The right panel can open a terminal. It also provides BYOK AI chat, but even I do not use that feature much; I do almost everything with Claude Code in terminal mode.

The most important thing is the name, MaekNote.[^12] The original intention came from "maek," as in maekrak, meaning context. As mentioned earlier, I think the most important job of an AI-native note app is to become the context hub that agents can refer to. That is why I named it that.

The logo carries the idea of becoming the standard for the next generation of note apps. Just as the Apple Notes logo iconifies the shape of a physical notebook, I wanted to iconify the most basic image of a note in the digital age: the first screen. A blank white page, with a vertical cursor blinking. That is the first thing we face when we open a note app.

Today, MaekNote has become more than a note app for me. It is an interface for using CLI tools and skills on top of all my materials and context. More precisely, I have been building it so that it can serve that role. I replaced several SaaS tools I used before with the combination of MaekNote context, Claude Code, and the skills system. I really like the idea of skills, and I have a lot of faith in it.[^13]

Here are some of the ways I actually use it.

When studying in the past, I mainly used tools like NotebookLM or ChatGPT projects. These days, my workflow is to put all lecture materials, assignments, and related files into a folder registered as a MaekNote workspace, then use Claude Code in chat to digest lectures, analyze slides, create exam prep materials, and get help with assignments. I have turned representative examples into skills. For example, I use a skill that analyzes assignments and past exams, then produces an exam prep plan and must-memorize notes based on all lecture slides. I also use a skill that reads assignment notices and related files, then creates a submission artifact that strictly satisfies the requirements based on the slides.[^14]

When writing personal statements, I run Claude Code at the root of my MaekNote workspace and paste in the prompts. It searches through the materials I have accumulated[^15] and finds the experiences or projects most relevant to the prompt, then helps set the direction. Sometimes I am genuinely surprised by the connections it finds between a prompt and an experience I had not thought of.

Everyone has probably had the experience of reading news or useful articles every day, saving them in a chat with themselves, and then never looking at them again. I collect those links in one file, schedule a Claude Code skill, and automate the whole flow: summarize and organize the links, generate the [yoonchulyi.com/daily-insights](https://yoonchulyi.com/daily-insights/) page, deploy through GitHub Actions, and reprocess the materials into card news. Since all of those materials live in one workspace, I can freely ask Claude Code questions, and it finds the most relevant references for me.

---

## The Note App for the AI Era

That does not mean I think Notion is no longer useful. But in the AI era, for the area of accumulating personal context and working with agents, I felt that a different kind of note app was needed. That is why I borrowed the name from maekrak,[^16] and why I plan to keep developing it by adding and removing features while thinking about what the standard note app for the AI era should be.

I still think Notion is a great tool, especially for collaboration. It is probably one of the best tools for building shared dashboards and workspaces. Its block-based UI and UX were genuinely innovative. But for purely personal productivity and note-taking, I have already replaced it with MaekNote. Or, more accurately, when combined with Claude Code, I feel I have upgraded to a better system.

Based on the philosophy and vision above, I want to keep developing MaekNote. Ultimately, I want to build the interface for the Jarvis era. The directions currently in my head are these.

First, meeting notes. I have started to think that STT may be better run locally now. I do not feel much need to pay a subscription for it. Model performance will keep converging,[^17] and if Claude Code handles the LLM-based auxiliary features, I do not think there is much to worry about. Of course, this is still a rough thought because I do not know this area deeply. But it seems hard to deny that note takers are an important channel for accumulating context, and from there it feels natural that MaekNote should include a note taker.

Second, in a similar vein, if local LLMs eventually become as usable as today's STT models, I would like to include them as well. Of course, even in that era, truly high-performance models will probably still be accessed through APIs. But lightweight tasks, or background context organization, may be something local models can handle. In the end, perhaps the combination of all of that will define the next note app.

Third, I am also thinking about providing our own context map. I want to offer a more advanced standard for context maps in an open form, similar to `agent.md` or `design.md`. More precisely, it may become a system that integrates these kinds of files.[^18] Personally, when coding, I collect the overall repo structure and each folder's role in Markdown files inside a `docs` folder. I am thinking about applying that shape to note folders and productivity workspaces: a literal map of context that records the overall structure, roles, and relationships of folders in detail.

Fourth, another major axis is dynamic UI.[^19] This also comes from thinking about Jarvis. I believe interfaces will no longer be fixed; they will be generated and modified in the format needed at that moment. Future note apps should provide that experience. Recently, a member of the Claude Code team shared a post called "[Unreasonable Effectiveness of HTML](https://x.com/trq212/status/2052809885763747935)," and I see it as an early sign of this direction. The point was that if we use HTML files instead of Markdown files as documents for sharing and organizing information, we can freely use dashboard-like UI and create a new kind of interactive shared document. Extended further, it means that what gets shared at each moment may not be a document, but a small website. What if we could freely generate tables, interactions, charts, and other forms that fit the character of the content?

---

## Closing

Before MaekNote, my projects were mostly attempts to find ideas that might work as startups. More honestly, I searched top-down for ideas that would sound logical when turned into a pitch deck or presented on a demo day.

As a reaction to that time,[^20] I went through a period of skepticism and came to feel that I should build something I genuinely needed, something I would genuinely like.

That was when the idea for MaekNote appeared, and I have been enjoying building it.

I still have not thought enough about GTM or monetization, and in truth I have avoided those questions intentionally. I wanted to focus a little longer on building what I wanted to build and what I felt should exist. At this stage, I am curious how many people who resonate with me and with the philosophy of this product can become users of the app, and I want to hear what those people think.

[^1]: Or Codex. For convenience, I will refer to it as Claude Code in this post, but in practice I moved back and forth between the two.
[^2]: Not just using it when a need appeared, but actively creating reasons to use it.
[^3]: Even when I first used Cursor, I often thought, "What if I replaced code here with some other kind of document?" It listens to the user's request, reads the existing `{code}`, decides what needs to be done, and edits or generates the appropriate `{code}`. If anything could be placed where `{code}` is, would that not be Jarvis?
[^4]: And these days it feels right to assume that everything in this space will keep improving.
[^5]: A.k.a. AGI.
[^6]: The simplest image is Jarvis. In this post, I will use Jarvis as shorthand for this overall direction.
[^7]: I even broke the first rule of the AI era, "Do not pay annually," and paid for a full year. At that point, I had not even considered the option of leaving Notion.
[^8]: This was about half a year ago, so I do not know what it is like now.
[^9]: Not the Microsoft product.
[^10]: In truth, it is less about competing than avoiding a position where we would simply be swallowed.
[^11]: Metadata is stored in SQLite for view convenience, but the source of truth is still the Markdown files.
[^12]: Many people are unsure how to pronounce it, so I am slightly wondering whether I should change it.
[^13]: It feels like a system with very little rigidity, which gives it broad generality. With only a small amount of guidance, it can make the most of the non-deterministic nature of LLMs; or, almost like hardcoding, it can run predefined scripts with minimal judgment. That flexibility makes the range of possible uses feel enormous. Some people say they abandoned MCP for skills, while others say skills are overrated, but my feeling is that this is the right answer.
[^14]: Of course, I do not actually one-click my assignments this way. Probably.
[^15]: Blog posts, project archives, and assignment archives.
[^16]: Context.
[^17]: A note-taking app founder once said that, unlike LLMs, STT is an area with "correct answers." I thought that was a surprisingly sharp insight.
[^18]: `agent.md`, `design.md`, `memory.md`, `soul.md`, etc.
[^19]: To be honest, I am not sure what exactly to call it. If I had to name the total concept I have in mind, would it be adaptive UI? On-demand UI?
[^20]: I had seen many playbooks where people found a good item through several iterations and succeeded through excellent execution, and I admired people who were good at that. If I had been good at it myself, I would probably still be doing it. But it is not something that happens quickly, and I did not have enough motivation to hold onto the present while staring at that possible future.

<!-- LANG:EN:END -->

<!-- LANG:KO:START -->

## 들어가며

5년 전, 대학교 1학년 때 한 친구가 노션이라는 것을 알려준 이후, 내 삶의 거의 모든 기록과 워크스페이스는 노션을 거쳐 왔다. 노션은 윈도우와 macOS 위에 올라간 두 번째 OS 같았다. 내 모든 맥락을 가지고 있었고, 거의 모든 작업의 시작점이었으며, 동시에 모든 것을 마무리해 넣는 아카이브였다.

그만큼 나는 노션이라는 툴을 사랑했다. 직접 노션 템플릿을 만들어 마켓플레이스에 올렸고, 6만 회가 넘는 다운로드를 기록했으며, 이를 통해 수십만 원 가까이 수익을 만들기도 했다. 그 과정에서 노션의 기능을 정말 구석구석 꼼꼼히 써 보았다.

그러다가 지난달, 결국 노션을 완전히 버렸다.

노션에 있던 내 모든 기록과 맥락을 로컬 마크다운 파일로 마이그레이션했다. 그리고 이 과정에서 로컬 마크다운 파일로도 노션과 같은 경험을 할 수 있는 노트 앱까지 직접 만들게 되었다. 목표는 하나였다. 내 생산성의 모든 것을 Claude Code, Codex 같은 CLI 툴들로 일원화하고, 내 모든 맥락을 CLI 에이전트들과 함께 쓰기 위해서였다.

이 글에서는 내가 왜 그런 결정을 내리게 되었는지, 왜 그걸 위해 앱을 새로 만들 수밖에 없었는지, 지금 어떻게 사용하고 있는지, 그리고 앞으로 어떻게 만들고 사용해 나갈 것인지에 대해 적어보려 한다.

---

## 툴 그 너머의 변화

내가 노션을 떠난 이유는 노션에 만족하지 않았기 때문이 아니다. 오히려 노션을 오래, 깊게 썼기 때문에 AI 에이전트 시대에는 내 모든 맥락이 특정 앱 안에, 그들만의 포맷으로 갇혀 있어서는 안 된다는 결론에 도달할 수 있었다.

Claude Code와 Codex 같은 CLI 에이전트 툴들을 사용하면서 나는 코딩 도구를 넘어선, 영화에서 보던 자비스 같은 범용 실행 시스템의 가능성을 보았다. 그 가능성을 제대로 쓰기 위해서는 내 기록과 워크플로가 이 에이전트들이 접근하기 편한 곳에, 언제든 누구나 접근 가능한 포맷으로 존재해야겠다는 생각을 하게 되었다.

작년 말부터 올해 초까지 Claude Code[^1]를 본격적으로 사용하게 되었다. 이 시점에 그동안 다른 AI 툴들을 쓰던 것과는 다른 느낌을 받았고, 본격적으로 내 모든 생산성 워크플로를 이 친구에게 맞추어야겠다고 느끼게 되었다. 이전에도 Claude Code를 코딩이 아닌 다른 생산성 업무에 활용한다는 사례는 종종 보아 왔다. Opus 4.5, 4.6 즈음부터 에이전틱 코딩에 회의적이었던 개발자들도 어느 정도 이제는 시대가 바뀌었다는 것을 인정하는 흐름이 있었던 것 같은데, 나도 이 즈음부터 Claude Code를 더 적극적으로[^2] 사용해 보아야겠다고 생각했고, 내 다른 생산성 업무에도 Claude Code를 도입해야겠다고 생각하게 되었다. Claude Code의 능력이 어느 정도 임계점을 넘었다고 느꼈던 지점도 있었고, 평소에도 AI 툴과 인터랙션하는 방법은 이런 방향성이 맞지 않나 생각하고 있었다.[^3]

그런 측면에서 Claude Code의 핵심은 Opus 같은 모델 자체의 성능도 있겠지만, 그 모델로 인해 동작하는 에이전틱 시스템이라고 생각한다. 이 시스템을 굴리는 모델의 성능이 더 좋아진다면[^4], 그 끝단의 작업을 코딩 대신 다른 어떤 작업으로 대체할 수 있다는 말도 일리가 없는 이야기는 아니다. 특히 노션처럼 마크다운 텍스트 문서 기반의 시스템에서 문서를 읽고, 작성하고, 편집하는 작업은 코드를 텍스트의 일종으로 본다면 당연히 잘할 수밖에 없을 것이다.

그래서 한번 시도해 보았다. 내 블로그 글, 참고하고 싶은 자료, 다른 플랫폼에서 쓴 글 등을 Cursor IDE에서 보면서 Claude Code로 자료를 정리하고 작성하는 것을 시도했다. 내가 요청한 사항에 대해 기존 코드베이스를 파악하고, 이를 바탕으로 코드를 수정하거나 새 코드를 생성하는 것처럼, 기존 자료들을 해석하고 필요한 문서를 생성하는 것을 보면서 "아, 이게 AI를 사용하는 방법의 미래구나"라는 생각을 했다.

먼 미래에는 범용 인공지능[^5]이 우리가 여러 툴과 AI 서비스를 통해 하고 있는 일들을 한 번에 처리해 줄 것이라 생각한다.[^6] 내가 생각하는 미래의 자비스를 쓰는 경험과 가장 유사한 경험은, 지금까지는 Claude Code를 통한 생산성 업무였다.

그래서 내 모든 생산성 업무를 Claude Code와 함께 하기로 결정했고, 그 즉시 가장 큰 병목이 무엇인지 알 수 있었다. 나는 그동안 내 모든 것을 노션에 기록해 왔다. 매일 쓰는 투두 리스트도 노션으로 기록했고, 새 프로젝트를 시작할 때도 노션 페이지부터 만들었고, 그것을 아카이빙하는 곳 또한 노션이었다.

그러나 노션과 Claude Code는 궁합이 썩 좋지 못했다. MCP나 공식 API는 로컬 레포를 다루는 것 같은 경험을 주지 못했다. 그래서 노션처럼 내 생산성 전반의 허브 역할을 하면서도 Claude Code가 접근 가능한 로컬 파일 기반 구조의 툴이 필요하다고 느꼈다. 당연히 Notion AI도 시도해 보았지만[^7], 태스크 크기가 커지면 성능이 만족스럽지 않았다.[^8]

설사 이 성능이 좋아지더라도, 언제 다른 에이전트와 툴이 더 좋아질지 모른다. 내 맥락과 내가 사용하는 인터페이스는 유지하고, 언제든 다른 AI 에이전트를 붙여서 쓸 수 있는 시스템이 필요하다고 느꼈다. 노션의 기존 데이터들을 export 했던 경험이 좋지 않았던 것도 한몫했다. AI 툴은 특히 선두 경쟁이 치열한 분야다. 그때마다 봇짐을 싸서 이곳저곳 옮겨 다니기보다는, 내가 인테리어를 다 해 놓은 내 집 안에 AI라는 집사를 들이는 경험이 더 맞는 방향이라고 생각했다.

줄이자면, 여러 AI 에이전트의 접근성이 좋으면서도 노션처럼 사람도 쓰기 좋은 인터페이스가 필요했다.

---

## MaekNote, 맥락의 허브

그래서 MaekNote를 만들었다. AI 지능 자체를 제공하는 앱이라기보다, 내 로컬 맥락 위에 어떤 에이전트든 붙일 수 있게 하는 인터페이스에 가깝다. 노션처럼 사람이 편하게 읽고 쓰는 경험은 유지하되, source of truth는 로컬 마크다운 파일에 두고, 그 옆에서 Claude Code나 Codex 같은 범용 에이전트가 내 자료를 직접 읽고 고칠 수 있게 하는 구조다.

나에게 MaekNote는 단순한 노트 앱이 아니라, 개인 생산성 워크플로 전체를 에이전트 친화적으로 다시 짜기 위한 로컬 맥락 OS다.

앞서 언급한 불편함들을 내가 처음 느낀 것이냐? 아니다. 이미 비슷한 불편을 겪은 사람들이 있었고, Obsidian과 Claude Code 조합이 어느 정도 정답처럼 전해지는 것 같았다. 나도 Obsidian을 시도해 보려 했지만, 플러그인 생태계 기반으로 노션과 같은 경험을 구축하기에는 진입 장벽이 있겠다고 생각했다. 요즘 같은 시대에, 거기에 익숙해질 시간에 내가 정확히 원하는 대로 하나 만들겠다는 생각을 하게 되었다.

결정적으로 노션과 Obsidian 모두 AI 시대에 탄생한 제품이 아니다. AI 시대에 적응하고 있는 제품이다. 이 카테고리에 관심이 많은 나로서는, AI 시대에 탄생한 AI 네이티브 툴이 하나 나와야 하지 않나 생각했다. 후술하겠지만, MaekNote의 원칙은 "AI 시대의 노트는 어때야 하나?"라는 질문에 근간을 두고 있다. 현재 있는 기능도, 앞으로 있을 기능도 그러할 것이다.

이러한 사고의 흐름 아래 프로덕트의 컨셉도 몇 번 수정을 거쳤다. 최종적으로 v1에서 정착한 컨셉은 이렇다.

> 로컬 마크다운 파일을 기반으로 노션의 경험을 최대한 재현하자. 그리고 옆에 터미널을 붙여서 Claude Code를 쓸 수 있게 하자.

노션의 핵심 경험인 마크다운 기반 노트와 데이터베이스 기능을 철저히 로컬 마크다운 파일을 source of truth로 지키면서 구현했고, 이 워크스페이스 전체를 Claude Code와 함께 co-pilot[^9]처럼 사용하는 경험을 주는 것을 목표로 했다. 로컬 LLM을 서빙하자, 우리만의 콘텍스트 맵을 자동으로 구축해 주자 등의 아이디어도 있었지만, 후술할 철학을 세운 후 현재의 스펙에 정착했다.

첫째, 최대한 투명하고 universal한 source of truth를 가져가서 우리 앱만의, 그리고 특정 앱만을 위한 포맷을 최소화한다. 우리의 노트들은 Obsidian에서도 열려야 하고, 우리 앱에서 만든 워크플로는 Cursor, VS Code, Claude Code, Codex 등 어떤 에디터와 에이전트를 조합하더라도 유효해야 한다. Notion에서 export한 데이터들은 사실상 원래의 쓰임새를 하나도 구현하지 못했다. v1에서는 사용자들의 워크플로를 MaekNote에 과하게 오버피팅하고 싶지 않았다. 전략적인 관점에서는 그런 요소를 조금씩 집어넣는 게 나을 수도 있겠지만, 어쨌든 초기 철학에는 맞지 않았기에 전부 배제했다.

둘째, 우리는 지능을 제공하지 않는다. OpenAI, Anthropic 같은 곳과 경쟁하기보다는[^10], 몇 개의 대형 프로바이더들이 자비스 같은 지능을 완성하여 세상을 지배할 때를 생각했을 때, 그 옆에서 가장 큰 가치를 제공할 수 있는 포지션에 있자는 생각이다. 지능은 온전히 빅테크 프로바이더들의 것을 사용할 수 있게 하고, 대신 언제든지 이들 사이에서 갈아타더라도 우리의 데이터와 맥락은 온전히 동일한 인터페이스 아래에서 보전될 수 있게 하자. 여러 회사에서 자비스를 만들어도 이들을 같이 혹은 번갈아 쓸 수 있는 인터페이스를 만들자. 이러한 철학이 우리 앱의 장기적인 비전을 형성했다.

그리하여 지금의 스펙이 도출되었다. 마크다운 에디터 기반의 노트를 기반으로 하고, YAML 헤더가 있는 마크다운 노트들을 개별 데이터로 삼아 데이터베이스를 구현했다.[^11] 그리고 우측 패널을 통해 터미널을 켤 수 있게 했다. BYOK 모델의 AI 채팅도 제공하지만, 나조차 이 기능은 잘 쓰지 않고 터미널 모드에서 Claude Code와 모든 것을 함께 한다.

가장 중요한 이름, MaekNote[^12]는 원래 맥락을 뜻하는 "맥"에서 왔다. 앞서 언급했듯 AI 네이티브 노트 앱의 가장 중요한 일은 에이전트들이 참고할 나의 맥락 허브가 되는 것이라 생각해서 그렇게 지었다.

로고는 차세대 노트 앱의 표준이 되고자 하는 의미를 담았다. 애플 노트의 로고가 실제 노트의 모양을 차용해서 아이콘화한 것처럼, 나는 디지털 시대 노트의 가장 기본적인 모습인 첫 화면을 아이콘화하고 싶었다. 빈 하얀 화면에 vertical bar 형태의 커서가 깜빡이는 모습. 우리가 노트 앱을 열었을 때 가장 처음 맞닥뜨리는 모습을 형상화하고자 했다.

이 MaekNote는 현재 나에게 노트 앱을 넘어 내 모든 자료와 맥락들 위에서 CLI 툴과 스킬을 활용하는 인터페이스가 되었다. 정확히 말하면 그렇게 쓰기 위해 만들어 왔다. 그래서 기존에 쓰던 SaaS들을 MaekNote 안의 콘텍스트, Claude Code, skills 시스템으로 대체했다. 나는 skill이라는 시스템을 굉장히 좋아하고, 이에 대한 믿음도 크다.[^13]

다음은 내가 실제로 활용하는 방향성들이다.

기존에 공부할 때는 NotebookLM이나 ChatGPT Projects 같은 기능을 주로 활용했었다. 요즘의 워크플로는 모든 강의 자료, 숙제 등을 MaekNote 워크스페이스로 등록된 폴더 안에 넣어 놓고, Claude Code와 채팅으로 강의 내용을 소화하고, 슬라이드들을 분석해서 시험 대비 자료도 제작하고, 숙제도 도움을 받는 방식이다. 대표적인 예시들은 스킬로 만들어 사용하고 있다. 과제와 기출문제를 바탕으로 시험 방향성을 분석해서 모든 강의 슬라이드를 기반으로 시험 대비 계획과 필수 암기 자료를 만들어 주는 스킬, 숙제 공지와 관련 파일들을 기반으로 슬라이드 기준의 요구사항을 엄밀히 충족시키는 과제 제출물을 제작해 주는 스킬[^14] 등이 있다.

자소서 같은 것을 작성할 때도 MaekNote 워크스페이스 루트에서 Claude Code를 실행한 후 문항들을 집어넣으면, 내가 그동안 쌓아온 자료들[^15]에서 해당 문항에 가장 적절한 나의 경험이나 프로젝트를 찾아와 방향성을 잡아준다. 내가 생각지도 못한 경험과 문항을 연동시킬 때면 나도 가끔 놀란다.

매일 뉴스나 유용한 아티클을 읽고, 카톡 나와의 채팅에 아카이빙하고, 다시는 보지 않는 경험은 누구나 하고 있을 것이다. 난 그런 링크들을 한 파일에 모으고, Claude Code 스킬을 스케줄하여 이 링크들을 요약 정리하고, [yoonchulyi.com/daily-insights](https://yoonchulyi.com/daily-insights/) 페이지를 생성하고, GitHub Actions로 배포하고, 자료를 재가공해 카드 뉴스로 제작하는 과정까지 자동화했다. 그리고 이 자료들이 한 워크스페이스 안에 모여 있기에, Claude Code에 자유롭게 질문하면 가장 관련이 있는 자료를 찾아와 준다.

---

## AI 시대의 노트 앱

그렇다고 내가 노션이 더 이상 필요 없는 도구라고 생각하는 것은 아니다. 그러나 AI 시대에서 개인의 콘텍스트를 쌓고 에이전트와 함께 다루는 영역에서는 다른 형태의 노트 앱이 필요하다고 느꼈다. 그래서 이름도 맥락[^16]에서 차용했고, AI 시대 노트 앱의 표준을 생각하며 다양한 기능들을 더하고 빼며 발전시켜 나갈 생각이다.

여전히 노션은 좋은 툴이라고 생각한다. 특히 협업 측면에서 공용 대시보드, 워크스페이스를 만들기에는 최적이라고 생각한다. 블록 기반의 UI/UX 또한 혁신이었다고 느낀다. 그러나 순수 개인 생산성, 노트라는 측면에서 나는 이미 MaekNote로 대체했다. 아니, Claude Code까지 결합한 시스템 측면에서는 한 단계 업그레이드했다.

앞서 말해 온 철학과 비전을 바탕으로 MaekNote를 더 발전시켜 나가고 싶다. 궁극적으로는 자비스 시대의 인터페이스를 만들기 위해서. 지금 머릿속으로 생각하고 있는 방향성은 다음과 같다.

첫 번째는 미팅 노트다. 이제 STT는 로컬로 돌리는 게 더 낫지 않나 하는 생각이 든다. 굳이 구독하면서 사용할 필요는 못 느낀다. 모델 성능은 갈수록 더 수렴할 것이고[^17], 주로 LLM을 사용하는 부가 기능들은 Claude Code와 함께 한다면 걱정이 없을 것 같다. 물론 이 분야를 깊게 아는 것은 아니라 러프한 생각이기는 하다. 다만 노트 테이커가 맥락을 쌓는 데 중요한 채널이라는 점은 이견이 없을 것이고, 그렇기에 MaekNote에 노트 테이커를 붙여야 한다는 것도 자연스러운 생각의 흐름인 것 같다.

두 번째로, 비슷한 측면에서 로컬 LLM도 지금의 STT 모델 정도로 쓸만해지는 날이 온다면 이 또한 탑재하고 싶다. 물론 그런 시대에서도 정말 고성능의 모델은 항상 API를 통해 접근하게 되겠지만, 가벼운 작업이나 백그라운드에서 콘텍스트를 정리하는 정도는 맡길 수 있지 않을까 싶다. 종국에는 그것까지 결합된 것이 새로운 노트 앱의 정의가 되지 않을까?

세 번째로, 우리만의 콘텍스트 맵을 제공하는 것도 생각하고 있다. `agent.md`, `design.md`처럼 오픈된 형태로 좀 더 고도화된 콘텍스트 맵의 표준을 제공하고 싶다. 좀 더 정확히는 이런 것들[^18]을 통합한 시스템이 되지 않을까 싶다. 개인적으로 코딩을 할 때는 전체 레포 구조, 폴더별 역할들을 `docs` 폴더에 모아서 마크다운 파일들로 관리하고 있는데, 이러한 형태를 노트 폴더에, 생산성 워크스페이스에 적용하는 형태를 생각하고 있다. 폴더의 전체적인 구조, 역할, 관계들을 상세히 기록한 말 그대로 맥락의 지도다.

네 번째 큰 축은 dynamic UI다.[^19] 이것 또한 자비스를 생각해 보면 된다. 우리가 쓰는 인터페이스가 고정되어 있지 않고, 그때그때 필요한 형식대로 생성되고 수정되는 UI가 올 것이라 생각하고, 미래의 노트 앱은 그런 경험을 제공해야 한다고 생각한다. 얼마 전 Claude Code 팀 멤버 중 한 명이 "[Unreasonable Effectiveness of HTML](https://x.com/trq212/status/2052809885763747935)"이라는 글을 공유했는데, 이게 그 시초라고 본다. 글의 요는 정보를 공유하고 정리하는 문서의 형태로 마크다운 파일이 아닌 HTML 파일을 사용하면 대시보드 같은 UI를 자유롭게 사용할 수 있고, 인터랙션이 가능한 새로운 형태의 공유 문서가 만들어진다는 것이었다. 이를 확장해 생각하면 그때그때 공유할 내용을 문서가 아니라 웹사이트로 만들어서 준다고도 생각할 수 있다. 콘텐츠의 성격에 맞는 형태의 테이블, 인터랙션, 차트 등을 자유로이 생성해서 볼 수 있다면 어떨까?

---

## 닫으며

MaekNote 전의 프로젝트들은 창업을 꿈꾸면서 될 것 같은 아이템을 찾아다녔다. 더 솔직히는 피치덱을 찍었을 때, 데모데이에서 말을 풀었을 때 말이 되는 논리가 될 것 같은 아이템을 탑다운으로 찾아다녔다.

이렇게 보낸 시간[^20]에 대한 반작용으로 회의감에 찬 시기를 보냈고, 진짜 순수하게 내가 필요한 것, 내가 좋아할 것을 만들어야겠다는 생각을 하게 되었다.

그런 생각을 할 때 MaekNote라는 아이디어가 생겼고, 즐겁게 만들어 왔다.

사실 GTM, monetization에 대한 고민은 아직 부족하고, 의도적으로 피해 왔다. 조금 더 순수하게 내가 만들고 싶은 것, 있어야 한다고 생각하는 것에 집중하면서 만들기 위해서다. 일단 이 단계에서는 나와 이 제품의 철학에 공감해 주는 사람들을 이 앱의 사용자로 얼마나 모아갈 수 있는지가 궁금하고, 그런 사람들의 생각을 듣고 싶다.

[^1]: 혹은 Codex. 편의를 위해 글에서는 Claude Code로 일원화하겠으나 실제로는 둘을 오가며 사용했다.
[^2]: 필요가 생기면 사용하는 것이 아니라 능동적으로 필요를 만들어서.
[^3]: Cursor를 초기에 쓸 때도, "여기에 코드 대신 다른 문서를 치환하면?"이라는 생각을 자주 했다. 사용자의 요구를 듣고 기존의 `{코드}`를 읽고 무엇을 해야 할지 판단하여 적절한 `{코드}`를 편집하거나 생성한다. 여기 `{코드}`의 자리에 다른 어떤 것이든 들어갈 수 있다고 생각하면 그것이 자비스가 아닐까?
[^4]: 그리고 요즘은 무엇이든 그렇게 가정하고 하는 것이 맞는 시대인 것 같다.
[^5]: a.k.a. AGI.
[^6]: 심플하게 자비스를 생각하면 될 것 같다. 이 글에서도 앞으로 심플하게 자비스라고 이 방향성 자체를 부르도록 하겠다.
[^7]: AI 시대의 제1원칙, "연간 결제를 하지 말아라"를 어기고 1년치를 긁기까지 했다. 그때는 내가 노션을 떠난다는 옵션 자체를 생각하지 못했으니까.
[^8]: 이것도 한 반년 전 이야기라 지금은 어떨지 모른다.
[^9]: Microsoft의 제품 아님.
[^10]: 사실 경쟁이라기보다는 곧 잡아먹힐 위치에 있기보다는.
[^11]: 뷰 편의성을 위해 SQLite 형태로 메타데이터가 저장되기는 하지만 source of truth는 마크다운 파일들이다.
[^12]: 많이들 발음을 헷갈려 해서 수정해야 하나 약간 고민이다.
[^13]: 굉장히 규율이 적고 그렇기에 범용성이 넓은 시스템 같다. 약간의 지침만 주어서 LLM의 non-deterministic한 특성을 최대한 활용할 수도 있고, 완전 하드코딩처럼 미리 주어진 스크립트를 최소한의 판단으로 실행하게 할 수도 있는 등 유연성이 크고, 그렇기에 활용 가능성이 무궁무진하다고 생각한다. MCP 버리고 skills로 갈아탔다는 사람도, overrated 되었다는 사람도 있지만, 내 느낌은 이게 정답 같다.
[^14]: 물론 실제로 이렇게 딸깍 해서 과제를 하지는 않는다. 아마도.
[^15]: 블로그 글, 프로젝트 및 과제 아카이브.
[^16]: context.
[^17]: LLM과 달리 "정답이 있는 영역"이라고 한 노트 테이킹 앱 대표님이 말씀하셨는데, 정말 절묘한 인사이트인 것 같다.
[^18]: `agent.md`, `design.md`, `memory.md`, `soul.md`, etc.
[^19]: 사실 정확히 이걸 뭐라고 해야 하는지 모르겠다. 내가 생각하는 총체적인 개념을 하나로 말한다면 무엇이 될 수 있을지. Adaptive UI? On-demand UI?
[^20]: 이런 식으로 좋은 item을 찾고, 여러 번의 iteration을 통해, 뛰어난 execution으로 성공하는 플레이북을 많이 보았고, 그걸 잘하는 사람들을 동경해 왔다. 물론 이런 걸 내가 잘 해냈다면 그걸 하고 있었겠지만, 그게 단기간에 되는 것도 아니고, 그런 미래를 바라보고 현재를 붙들고 있기에는 나에겐 동기부여가 부족했던 것 같다.

<!-- LANG:KO:END -->
