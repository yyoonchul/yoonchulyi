Title: Optimizing Content for Agents

URL Source: http://cra.mr/optimizing-content-for-agents/

Published Time: Thu, 12 Mar 2026 21:31:50 GMT

Markdown Content:
Optimizing Content for Agents
===============

[cra mr](http://cra.mr/)
========================

[](https://twitter.com/zeeg)[](https://github.com/dcramer)[](http://cra.mr/rss.xml)[](http://cra.mr/astro)[](http://cra.mr/optimizing-content-for-agents/)

![Image 1: Optimizing Content for Agents](http://cra.mr/ai-content/optimizing-content-for-agents.png)

Optimizing Content for Agents
=============================

 Mar 12, 2026 5 min read

> Just as useless of an idea as LLMs.txt was
> 
> 
> It’s all dumb abstractions that AI doesn’t need because AIs are as smart as humans so they can just use what was already there, which is APIs

LLMs.txt is _indeed_ useless, but that’s the only thing correct in this statement. I’m here once again being rage baited to address more brainless takes on social media. This one is about content optimization.

Short and to the point: you should be optimizing content for agents, just as you optimize things for people. How you do that is an ever-evolving subject, but there are some common things we see:

*   order of content
*   content size
*   depth of nodes

Frontier models and the agents built on top of them all behave similarly, with similar constraints and optimizations. For example, one thing they’re known to do, to avoid context bloat, is to only read parts of files. The first N lines, or bytes, or characters. They’re also known to behave very differently when they’re told information exists somewhere vs. having to discover it on their own. Both of those concerns are actually why LLMs.txt was a valuable idea, but it was the wrong implementation.

The implementation today is simple: content negotiation. When a request comes in with `Accept: text/markdown`, you can confidently assume you have an agent. That’s your hook, and now it’s just up to you how you optimize it. I’m going to be brief and to the point and just give you a few examples of how we do that at Sentry.

[#](http://cra.mr/optimizing-content-for-agents/#docs)Docs
----------------------------------------------------------

We’ve put a bunch of time into optimizing our docs for agents, for obvious reasons. The primary optimizations are mostly simple:

1.   Serve true markdown content - massive tokenization savings as well as improved accuracy
2.   Strip out things that only make sense in the context of the browser, especially navigation and JavaScript bits
3.   Optimize various pages to focus more on link hierarchy - our index, for example, is mostly a sitemap, completely different than non-markdown

```
$ curl -H "Accept: text/markdown" https://docs.sentry.io/

---
title: "Sentry Documentation"
url: https://docs.sentry.io/
---

# Sentry Documentation

Sentry is a developer-first application monitoring platform that helps you identify and fix issues in real-time. It provides error tracking, performance monitoring, session replay, and more across all major platforms and frameworks.

## Key Features

* **Error Monitoring**: Capture and diagnose errors with full stack traces, breadcrumbs, and context
* **Tracing**: Track requests across services to identify performance bottlenecks
* **Session Replay**: Watch real user sessions to understand what led to errors
* **Profiling**: Identify slow functions and optimize application performance
* **Crons**: Monitor scheduled jobs and detect failures
* **Logs**: Collect and analyze application logs in context

...
```

In our case we actually use MDX to render these, so it involved a handful of parsing changes and overrides to allow certain key pages to render differently. The result: agents fetch pages that are much more actionable.

[#](http://cra.mr/optimizing-content-for-agents/#sentry)Sentry
--------------------------------------------------------------

If a headless bot is fetching the website, the least useful thing you can do is serve it an authentication-required page. In our case we use the opportunity to inform the agent that there are a few programmatic ways it can access the application information (MCP, CLI, API, etc):

```
$ curl -H "Accept: text/markdown" https://sentry.io

# Sentry

You've hit the web UI. It's HTML meant for humans, not machines.
Here's what you actually want:

## MCP Server (recommended)

The fastest way to give your agent structured access to Sentry.
OAuth-authenticated, HTTP streaming, no HTML parsing required.

```json
{
  "mcpServers": {
    "sentry": {
      "url": "https://mcp.sentry.dev/mcp"
    }
  }
}
```

Docs: https://mcp.sentry.dev

## CLI

Query issues and analyze errors from the terminal.

https://cli.sentry.dev

...
```

[#](http://cra.mr/optimizing-content-for-agents/#warden)Warden
--------------------------------------------------------------

For projects like [Warden](https://warden.sentry.dev/), we actually set it up so the agent can hit the entire content to bootstrap itself:

> Help me set up warden.sentry.dev

```
curl -H "Accept: text/markdown" https://warden.sentry.dev

# Warden

> Agents that review your code. Locally or on every PR.

Warden watches over your code by running **skills** against your changes. Skills are prompts that define what to look for: security vulnerabilities, API design issues, performance problems, or anything else you want consistent coverage on.

Skills follow the [agentskills.io](https://agentskills.io) specification. They're markdown files with a prompt that tells the AI what to look for. You can use community skills, write your own, or combine both.

- Docs: https://warden.sentry.dev
- GitHub: https://github.com/getsentry/warden
- npm: https://www.npmjs.com/package/@sentry/warden

## How It Works

Every time you run Warden, it:

1. Identifies what changed (files, hunks, or entire directories)
2. Matches changes against configured triggers
3. Runs the appropriate skills against matching code
4. Reports findings with severity, location, and optional fixes

Warden works in two contexts:

- **Locally** - Review changes before you push, get instant feedback
- **In CI** - Automatically review pull requests, post findings as comments

## Quick Start

...
```

[#](http://cra.mr/optimizing-content-for-agents/#thats-it)That’s It
-------------------------------------------------------------------

It’s simple and it works. You should do it. You should also pay attention to how patterns are changing with agents and update your optimizations as behavior changes.

More Reading
------------

2026
----

[](http://cra.mr/building-a-slack-agent-with-pi-on-vercel)
### Building a Slack Agent with Pi on Vercel

 Feb 25, 2026 

[](http://cra.mr/skill-synthesis)
### Skill Synthesis

 Feb 23, 2026 

[](http://cra.mr/context-management-and-mcp)
### Context Management and MCP

 Feb 2, 2026 

[](http://cra.mr/your-code-is-under-new-management)
### Your code is under new management

 Feb 2, 2026 

[](http://cra.mr/mcp-skills-and-agents)
### MCP, Skills, and Agents

 Jan 20, 2026 

 © 2026 David Cramer — [Archive](http://cra.mr/archive/)
