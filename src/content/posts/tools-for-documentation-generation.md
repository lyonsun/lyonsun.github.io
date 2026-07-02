---
title: "LLMs for automated documentation generation"
description: "Automating documentation generation with large language models improves code maintainability and reduces manual effort."
pubDate: 2026-07-02
author: Meta Llama 3.3 70b
aiGeneratedContent: true
draft: true
tags:
  - ai
  - documentation
  - workflow
---

Automated documentation generation has become a crucial aspect of software development, and large language models have emerged as a promising solution. By leveraging these models, developers can save time and effort while maintaining accurate and up-to-date documentation. In this post, we will explore various approaches to generating documentation from code, including JSDoc/TSDoc comments, README generation, API reference docs, and changelogs.

## Approaches to Automated Documentation Generation

There are several methods to generate documentation from code, each with its strengths and weaknesses. Some of the most common approaches include:

- **JSDoc/TSDoc comments**: These comments provide a way to document code using a standardized format. Large language models can parse these comments to generate documentation.
- **README generation**: Large language models can analyze code and generate a README file that provides an overview of the project, its dependencies, and usage instructions.
- **API reference docs**: For projects with APIs, large language models can generate API reference documentation, including endpoint descriptions, parameter information, and response formats.
- **Changelogs**: Large language models can also generate changelogs by analyzing commit history and identifying changes, additions, and removals.

## Quality Control and Syncing Docs with Code

To ensure the quality and accuracy of generated documentation, it is essential to implement quality control measures. This can include:

- **Code reviews**: Regular code reviews can help identify inconsistencies between code and documentation.
- **Automated testing**: Automated tests can verify that documentation is accurate and up-to-date.
- **Continuous integration/continuous deployment (CI/CD) pipelines**: Integrating documentation generation into CI/CD pipelines ensures that documentation is generated and updated automatically with each code change.

Here's an example of how to use the `@langchain/core/prompts` library to generate documentation from JSDoc comments:

```javascript
import { PromptTemplate } from "@langchain/core/prompts";
import { OpenAIAPI } from "openai";

const openai = new OpenAIAPI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: "YOUR_API_KEY",
});

const template = PromptTemplate.fromTemplate(
  "Generate documentation for the following JSDoc comments: {{comments}}",
);
const comments = `
/**
 * Adds two numbers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function add(a, b) {
  return a + b;
}
`;

(async () => {
  const prompt = template.format({ comments });
  const response = await openai.complete({
    model: "gpt-4",
    prompt: prompt,
    maxTokens: 1024,
  });
  console.log(response.data.text);
})();
```

This code generates documentation for the `add` function using the provided JSDoc comments.

## Implementation Considerations

When implementing automated documentation generation, consider the following factors:

- **Model selection**: Choose a suitable large language model for your documentation generation needs.
- **Template design**: Design effective templates to guide the model in generating accurate documentation.
- **Integration with existing workflows**: Integrate documentation generation into your existing CI/CD pipelines and workflows.

## Conclusion

Automated documentation generation with large language models offers a promising solution for reducing manual effort and improving code maintainability. By surveying various approaches and implementing quality control measures, developers can ensure that their documentation is accurate, up-to-date, and in sync with their code. Start simple, and gradually add complexity to your documentation workflow as needed.
