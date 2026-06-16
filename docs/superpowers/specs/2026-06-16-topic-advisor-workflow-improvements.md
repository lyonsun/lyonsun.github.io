# Topic-advisor workflow improvements

## Motivation

PR #119 revealed two issues in the automated topic-advisor workflow:

1. **Pluralization ugliness**: `topic-advisor.mjs` uses `"topic(s)"` in log messages and PR body, which looks unprofessional.
2. **Title/tag quality**: The LLM-generated topics use lowercase acronyms (e.g., `llms`, `api`, `ai`) and tags that don't follow existing conventions (e.g., `llms` vs `llm`, `frontend-development` vs `frontend`).

## Changes

### 1. Pluralization fix (`topic-advisor.mjs`)

- Add a `pluralize(count)` helper that returns `"topic"` or `"topics"`.
- Replace all 4 `"topic(s)"` usages (console.log and PR body) with proper pluralization.

### 2. Prompt improvement (`topic-advisor-prompt.md`)

Two additions to the prompt:

- **Acronym casing rule**: Add "Acronyms in titles must be uppercase (e.g., `LLM`, `API`, `AI`, `CI/CD`)."
- **Stronger tag rule**: Change tag instruction to: "Reuse existing tags when possible. Prefer existing tags over introducing new ones (e.g., use `llm` not `llms`, `frontend` not `frontend-development`). Only introduce new tags when no existing tag fits the concept."

## Files changed

- `.github/scripts/topic-advisor.mjs` — pluralize helper, replace "topic(s)"
- `.github/scripts/topic-advisor-prompt.md` — add casing + tag convention rules
