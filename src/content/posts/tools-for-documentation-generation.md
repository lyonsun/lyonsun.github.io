---
title: "LLMs for automated documentation generation"
description: "This post explains how to use LLMs to generate and keep documentation in sync with code, covering JSDoc, README, API reference, and changelog strategies."
pubDate: 2026-07-02
author: Openai/gpt Oss 20b
aiGeneratedContent: true
draft: true
tags:
  - ai
  - documentation
  - workflow
---

<think>
Here's a thinking process:

1.  **Analyze User Input:**

- **Role:** Technical blog editor
- **Task:** Revise the given blog post to be more technically accurate, deeper, and clearer. Use JS/TS for code.
- **Constraints:**
  - Output FULL revised post content (300-500 words)
  - Never output empty/partial content
  - Do not change topic, angle, or overall structure
  - Return ONLY the revised markdown body (no title, metadata, frontmatter)
  - Always produce revised content, even if minor polish
  - Code examples: ESM/import syntax, correct constructor/API patterns, self-contained, proper async handling (IIFE for top-level await), verify SDK methods exist
  - Headings: sentence case
  - Avoid security issues (shell injection, etc.)
  - No code fences wrapping the entire output
  - OpenAI SDK examples: use Groq endpoint (`baseURL: 'https://api.groq.com/openai/v1'`), current models, never `createCompletion` or `text-davinci-003`
  - Description must be a complete sentence with subject and verb (not gerund)
  - Single quotes for strings in JS/TS
- **Input Post Structure:**
  - Opening hook
  - Main sections: JSDoc/TSDoc extraction, README generation from code snippets, API reference and changelog synthesis
  - When it breaks
  - Closing
- **Issues in Input Post:**
  - `LLMChain` is deprecated/removed in newer LangChain versions. Modern LangChain uses `RunnableSequence` or direct `llm.invoke()` or `prompt.pipe(llm)`. I should update to modern LangChain patterns (`prompt.pipe(llm)` or direct `openai.chat.completions.create` for simplicity, but the prompt uses LangChain. I'll stick to LangChain but use the modern `RunnableSequence` or `prompt.pipe(llm)` pattern, or just use the OpenAI SDK directly for consistency. Actually, the prompt says "Use JavaScript or TypeScript for all code examples" and "Code examples must use correct constructor and API patterns from the actual SDKs." LangChain's `LLMChain` is legacy. I'll update to `prompt.pipe(llm).invoke()` which is the standard modern LangChain v0.2+ pattern.
  - `model` is not a valid constructor option for `OpenAI` client. It's passed to `chat.completions.create()`.
  - The OpenAI SDK examples need to use Groq's endpoint correctly.
  - `execSync` for git log is fine, but I should ensure it's safe and properly handled. The constraint says "Avoid patterns with obvious security issues (shell injection via exec, etc.)". `execSync` with a hardcoded string is fine, but I'll make sure it's clear.
  - Need to ensure all code blocks are self-contained, use IIFE for top-level await, use single quotes, and follow ESM.
  - Word count: 300-500 words. I need to be concise but deep.
  - Headings must be sentence case.
  - Description must be a complete sentence. (This likely refers to the opening hook or a specific requirement, but I'll make sure the opening is a complete sentence.)

2.  **Technical Corrections & Improvements:**

- **LangChain v0.2+**: `LLMChain` is deprecated. Use `prompt.pipe(llm)`.
- **OpenAI Client**: `model` goes in `chat.completions.create()`, not constructor.
- **Groq Endpoint**: `baseURL: 'https://api.groq.com/openai/v1'`
- **Async Handling**: Wrap in `(async () => { ... })()`
- **Self-contained**: All imports and variables defined.
- **Single quotes**: Enforce throughout code.
- **Depth**: Explain _why_ the modern pattern works better, mention token limits, caching, and structured outputs briefly if needed, but keep within word limit.
- **Structure**: Keep the exact sections but adjust headings to sentence case.
- **Word Count**: Aim for ~350-450 words.

Let's draft carefully.

_Opening hook_: When a new feature lands, the README and API docs are often the first thing a developer reads, yet they are usually the last thing updated. An automated pipeline that pulls fresh code, runs an LLM, and outputs consistent documentation can cut onboarding time by half.

_Section 1: JSDoc extraction_
Need to fix LangChain usage. Modern LangChain uses `ChatGroq` or `ChatOpenAI` with Groq base URL. Actually, using the OpenAI SDK directly is simpler and more standard for this use case, but the prompt uses LangChain. I'll stick to LangChain but use the correct v0.2+ pattern: `import { ChatOpenAI } from '@langchain/openai';` and `prompt.pipe(llm)`. Wait, the constraint says "Code examples using the OpenAI SDK must use Groq's OpenAI-compatible endpoint". I'll use the OpenAI SDK directly for all examples to ensure consistency and avoid LangChain version confusion, or I'll fix the LangChain examples to be strictly correct. Actually, using the OpenAI SDK directly is safer and aligns with the constraint. I'll rewrite the examples to use the `openai` package directly, as it's more standard and avoids deprecated LangChain chains. But the original uses LangChain. I'll keep LangChain but fix it to modern standards, or switch to OpenAI SDK for simplicity. The constraint says "Code examples using the OpenAI SDK must use Groq's...". I'll use the OpenAI SDK directly for all three to be safe and accurate.

Let's draft the code blocks carefully.

Block 1 (JSDoc):

```ts
import { OpenAI } from "openai";

(async () => {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const jsdoc = `/**
   * Calculates the factorial of a number.
   * @param {number} n - The number to factor.
   * @returns {number} The factorial.
   */
  function factorial(n) { /* … */ }`;

  const response = await client.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "Convert the following JSDoc into concise Markdown documentation.",
      },
      { role: "user", content: jsdoc },
    ],
  });

  console.log(response.choices[0].message.content);
})();
```

Block 2 (README):

```ts
import { OpenAI } from "openai";

(async () => {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const code = `export function add(a, b) { return a + b; }
  export function subtract(a, b) { return a - b; }`;

  const response = await client.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "Write a concise README for a library that exports the following functions. Include usage examples.",
      },
      { role: "user", content: code },
    ],
  });

  console.log(response.choices[0].message.content);
})();
```

Block 3 (Changelog):

```ts
import { OpenAI } from "openai";
import { execSync } from "node:child_process";

(async () => {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const commits = execSync('git log --pretty=format:"%h %s" -n 10', {
    encoding: "utf-8",
  });

  const response = await client.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "Generate a changelog in Markdown from these commit messages. Format with an Unreleased header and bullet points.",
      },
      { role: "user", content: commits },
    ],
  });

  console.log(response.choices[0].message.content);
})();
```

Check constraints:

- ESM/import syntax: Yes
- Correct constructor/API: Yes, OpenAI SDK v4+
- Self-contained: Yes
- Async IIFE: Yes
- Verify methods: `chat.completions.create` exists
- Sentence case headings: "JSDoc extraction", "Readme generation from code snippets", "Api reference and changelog synthesis", "When it breaks", "Closing" -> I'll adjust to match original but sentence case
