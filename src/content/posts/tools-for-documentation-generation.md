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

Opening hook  
When a new feature lands, the README and API docs are often the first thing a developer reads—and yet they’re usually the last thing updated. An automated pipeline that pulls fresh code, runs an LLM, and outputs consistent, up‑to‑date documentation can cut onboarding time by half.

Main sections

### JSDoc/TSDoc extraction

JSDoc comments are the most reliable source of type information. An LLM can read the comments, infer intent, and emit Markdown.

```ts
import { OpenAI } from "openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "@langchain/core/chains";

(async () => {
  const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    model: "llama3-70b-8192",
  });

  const jsdoc = `
/**
 * Calculates the factorial of a number.
 * @param {number} n - The number to factor.
 * @returns {number} The factorial.
 */
function factorial(n) { /* … */ }
`;

  const prompt = PromptTemplate.fromTemplate(
    `You are a documentation generator. Convert the following JSDoc into Markdown:

\`\`\`js
{jsdoc}
\`\`\`

Output:`,
  );

  const chain = new LLMChain({ llm: openai, prompt });
  const result = await chain.invoke({ jsdoc });
  console.log(result.output);
})();
```

Trade‑off: You get precise, type‑aware docs, but the LLM may hallucinate implementation details if the comments are sparse.

### README generation from code snippets

A README can be auto‑filled by summarizing exported modules.

```ts
import { OpenAI } from "openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "@langchain/core/chains";

(async () => {
  const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    model: "llama3-70b-8192",
  });

  const code = `
export function add(a, b) { return a + b; }
export function subtract(a, b) { return a - b; }
`;

  const prompt = PromptTemplate.fromTemplate(
    `Write a concise README for a library that exports the following functions:

\`\`\`js
{code}
\`\`\`

Include usage examples.`,
  );

  const chain = new LLMChain({ llm: openai, prompt });
  const result = await chain.invoke({ code });
  console.log(result.output);
})();
```

Trade‑off: The README stays current, but you lose control over tone unless you supply style guidelines.

### API reference and changelog synthesis

Pull the Git history, feed commit messages and diffs to an LLM, and let it produce a changelog.

```ts
import { OpenAI } from "openai";
import { execSync } from "node:child_process";

(async () => {
  const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    model: "llama3-70b-8192",
  });

  const commits = execSync('git log --pretty=format:"%h %s"', {
    encoding: "utf-8",
  });

  const prompt = `
Generate a changelog in Markdown from these commit messages:

${commits}

Format:
## [Unreleased]
- ...
`;
  const response = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    max_tokens: 512,
  });

  console.log(response.choices[0].message.content);
})();
```

Trade‑off: You get a readable changelog instantly, but the LLM may mis‑categorize commits without a robust classification prompt.

When it breaks  
LLMs hit context limits when codebases grow; you’ll need to chunk or summarize. Costs rise linearly with token usage, so a poorly scoped prompt can blow the bill. Non‑determinism means repeated runs may produce slightly different docs—use a seed or post‑process diffs to enforce consistency. Finally, if the source comments are incomplete, the LLM will fabricate details, leading to misleading docs.

Closing  
Start by wiring a single LLM call to JSDoc extraction, then layer README and changelog generators. Keep a lightweight CI check that diffs the generated docs against the repository; if the diff is non‑empty, flag a manual review. This staged approach balances automation with human oversight, ensuring documentation stays accurate without becoming a maintenance burden.
