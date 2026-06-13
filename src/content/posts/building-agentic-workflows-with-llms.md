---
title: "Building agentic workflows with LLMs"
description: "Real patterns for building LLM agents: tool-use loops, ReAct, and self-correction with runnable code examples."
pubDate: 2026-06-08
author: Liang Sun
tags:
  - ai
  - agentic
  - workflow
  - llm
  - patterns
---

"Agentic" is the word of the year in AI. Every demo shows an agent autonomously browsing the web, writing code, and booking flights. But underneath the hype, the patterns are remarkably simple — and composable. Once you understand three core patterns, you can build reliable agents for a wide range of tasks.

## Pattern 1: The tool-use loop

This is the foundation. An LLM alone can't interact with the outside world — it can only generate text. Tool-use gives it that ability by wrapping external functions (APIs, databases, file systems) as callable tools.

The loop has four steps:

1. Call the LLM with a user request and a list of available tools.
2. The LLM responds with a tool call (or the final answer).
3. Execute the tool and return the result to the LLM.
4. Repeat until the LLM produces a final answer.

Here it is with the OpenAI SDK:

```javascript
import OpenAI from "openai";

const openai = new OpenAI();

const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a city",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string" },
        },
        required: ["city"],
      },
    },
  },
];

async function agentLoop(userMessage) {
  const messages = [{ role: "user", content: userMessage }];

  while (true) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
    });

    const choice = response.choices[0];
    const toolCalls = choice.message.tool_calls;

    if (!toolCalls) {
      return choice.message.content;
    }

    messages.push(choice.message);

    for (const call of toolCalls) {
      const result = await executeTool(call);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }
}
```

The loop is the core primitive. Everything else — ReAct, reflection, multi-agent — builds on top of this.

## Pattern 2: ReAct (reasoning + acting)

The tool-use loop works, but the LLM doesn't always pick the right tool. ReAct addresses this by asking the model to reason before and after each action, producing a chain of thought.

The key difference: instead of calling the LLM directly, you prompt it to output "Thought: ... Action: ... Observation: ..." in a structured cycle. Modern function-calling APIs do this implicitly — the model reasons internally before emitting a tool call — but explicit ReAct is useful when you want to inspect or steer the reasoning.

```javascript
const REACT_PROMPT = `You are an assistant that solves problems step by step.
For each step, think about what you need to do, then call the appropriate tool.
When you have the final answer, say "Answer: ..."`;

async function reactLoop(userMessage) {
  const messages = [
    { role: "system", content: REACT_PROMPT },
    { role: "user", content: userMessage },
  ];

  for (let step = 0; step < 10; step++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
    });

    const choice = response.choices[0];
    messages.push(choice.message);

    if (choice.message.content?.startsWith("Answer:")) {
      return choice.message.content;
    }

    for (const call of choice.message.tool_calls ?? []) {
      const result = await executeTool(call);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: `Observation: ${JSON.stringify(result)}`,
      });
    }
  }

  throw new Error("Max steps reached without a final answer");
}
```

ReAct gives you a reasoning trace you can log, debug, or audit. The trade-off: each step costs more tokens (the accumulated reasoning history grows fast), and there's no guarantee the model will converge.

## Pattern 3: Reflection and self-correction

Agents make mistakes — they call the wrong tool, misinterpret results, or hallucinate outputs they should have computed. Reflection adds a meta-step where the agent reviews its own work and decides whether to retry.

A simple approach: after the agent produces an answer, feed it back as a new prompt asking the agent to verify its work.

```javascript
async function reflectiveAgent(task) {
  const answer = await agentLoop(task);

  const verification = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a verifier. Check if the answer is correct and complete. If not, explain what is wrong.",
      },
      { role: "user", content: `Task: ${task}\nAnswer: ${answer}` },
    ],
  });

  const verdict = verification.choices[0].message.content;

  if (verdict.includes("incorrect") || verdict.includes("incomplete")) {
    return agentLoop(
      `${task}\n\nPrevious attempt: ${answer}\n\nIssues: ${verdict}\n\nPlease try again.`,
    );
  }

  return answer;
}
```

This is a coarse but effective pattern. More sophisticated approaches include having the agent explicitly call a "self-critique" tool, or running multiple agents in parallel and voting on the best answer. The cost is obvious — you're running 2x-3x the LLM calls.

## When it breaks

These patterns work well for structured tasks with clear success criteria. In practice, they fail in predictable ways:

- **Context limits.** Every loop iteration appends tool results and reasoning to the message list. A long-running agent hits the model's context window within a few dozen steps. You need to summarize, prune, or paginate history.
- **Cost blowup.** Reflection triples your token spend. ReAct doubles it. An agent that loops 20 times before converging costs 20x a single call. Budget-aware architectures are an active research area.
- **Compounding errors.** A wrong tool call produces bad output, which feeds the next LLM call, which makes a worse decision. Without validation checkpoints, errors cascade.
- **Non-determinism.** The same agent on the same input produces different results each run. Testing requires statistical evaluation, not assertion-based tests.
- **No real autonomy.** Despite the hype, today's agents cannot handle ambiguous instructions, recover from unexpected tool failures, or navigate API changes. Human supervision is still required for anything beyond toy demos.

## A practical takeaway

Start with the simple tool-use loop. If your task needs it, add ReAct for debuggability. Add reflection only when you've measured that the agent makes errors worth catching. Each layer of complexity has a real cost — tokens, latency, and failure modes of its own.

The patterns here compose: you can put a tool-use loop inside a reflective agent, or give a ReAct agent a "self-critique" tool. But don't build what you don't need yet. A single well-designed tool call often beats a multi-agent deliberation.
