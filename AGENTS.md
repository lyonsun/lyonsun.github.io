# Git Workflow Rules

## Commits

- **Never commit without explicit user approval** — always ask first
- Follow [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- Format: `type(scope): description`
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
  - Scope is optional but recommended (e.g., `perf(layout): optimize font loading`)
- Keep commit messages under 72 characters
- Commit only the files relevant to the change
- Never commit secrets, keys, or `.env` files

## Before Committing

- Run `npm run build` to verify the build passes
- Run typecheck/lint if available (`npx astro check`)
- Review `git diff` before staging

## Branches

- **Always create a new branch per issue** — never work directly on main
- Follow Conventional Commits naming: `<type>/<short-description>` (e.g., `perf/optimize-fonts`, `fix/broken-link`)
- Keep branches focused on a single change

## Pull Requests

- **Always create a PR** — no direct commits to main
- Exception: single-line doc fixes (typos, formatting) may be committed directly
- PR title should match the Conventional Commits format
- Include a brief description of what changed and why
- Reference Linear issue numbers when applicable (e.g., `Ref: LYO-24`)

## Linear Integration

- When working on a Linear issue, mention it in commits: `Ref: LYO-NN`
- Update issue status when work is complete
