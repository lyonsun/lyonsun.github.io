# Project Overview

This is a personal portfolio/blog website built with **Astro v7**, deployed to GitHub Pages at `https://lyonsun.github.io`.

## Tech Stack

- **Framework**: Astro v6
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Language**: TypeScript (strict mode, `astro/tsconfigs/strict`)
- **Content**: Markdown blog posts (`src/content/posts/**/*.md`) loaded via `glob` loader with Zod validation
- **Formatting**: Prettier with `prettier-plugin-astro` and `prettier-plugin-tailwindcss`
- **AI Tooling**: OpenCode with superpowers plugin (`opencode.json`)
- **Deployment**: GitHub Pages via GitHub Actions (Node 24, `npm ci`)
- **Dependency Updates**: Renovate (groups patch/minor together)

## Key Commands (no test framework)

| Command           | Description                                 |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start Astro dev server                      |
| `npm run build`   | Build static site to `dist/`                |
| `npm run preview` | Preview production build                    |
| `npm run check`   | Type-check (`astro check`)                  |
| `npm run format`  | Format with Prettier (`prettier --write .`) |

## Project Structure

- Atomic design in `src/components/`, content in `src/content/posts/`, pages in `src/pages/`, configs at root.

## Code Conventions

### Prettier (non-default)

- Tab width: **4 spaces** (for `.astro`, `.ts`, `.js`)
- Single quotes, trailing commas: all, semicolons required, print width 80

### Components

- Atomic design: `atoms/` → `elements/` → `sections/`
- Decorative SVGs: `aria-hidden="true"`; external links: `rel="noopener noreferrer"`

## Content (Blog Posts)

Required frontmatter: `title`, `description`, `pubDate`. Optional: `tags` (default `[]`), `author`, `updatedAt`, `draft` (default `false`), `aiGeneratedContent` (default `false`). Schema in `src/content.config.ts`.

- **Title case**: Use sentence case for all post titles (e.g., "How AI coding assistants actually work", not "How AI Coding Assistants Actually Work").

## CI / Lighthouse

- **Deploy**: Push to `main` → GitHub Pages. Uses `actions/checkout@v6`, `actions/setup-node@v6`, `actions/configure-pages@v6`, `actions/deploy-pages@v5`, `actions/upload-pages-artifact@v5`.
- **Lighthouse**: Daily 09:00 UTC (scheduled + manual trigger). Desktop preset, 3 runs. Threshold ≥0.9 for all categories. Failures create a GitHub issue with label `lighthouse`.
- **Budget** (lighthouse-budget.json): total ≤150KB, script ≤20KB, stylesheet ≤30KB, font ≤80KB, image ≤100KB. FCP ≤1.5s, LCP ≤2.5s, TBT ≤200ms, CLS ≤0.1.
- **PR Review**: OpenCode review via `anomalyco/opencode/github@latest` (model `opencode/deepseek-v4-flash-free`). Skips Renovate/Dependabot PRs.

## Blog Workflows

- **Blog Writer** (`.github/workflows/blog-writer.yml`): Scheduled Mon/Thu 09:00 UTC + manual trigger. Generates AI blog posts via Groq, creates PRs with `draft: true`. Uses `GROQ_API_KEY` and `BLOG_WRITER_PAT` secrets.
- **Topic Advisor** (`.github/workflows/topic-advisor.yml`): Scheduled Mon 09:00 UTC + manual trigger. Suggests new blog topics via Groq, updates `.github/scripts/topics.json`, creates PRs.

## Site Details

- Site URL: `https://lyonsun.github.io` (override via `SITE_URL` env var in `astro.config.ts`)
- Font: Self-hosted Saira variable (`/fonts/saira-variable-latin.woff2`), preloaded in `<head>`
- OG image: `src/assets/og-image.png` → WebP via `astro:assets`
- Analytics: GA4 in `src/meta/ga4.astro`
- RSS: `/rss.xml` via `@astrojs/rss`
- Page title: falls back to `SITE_NAME` if no `title` prop passed to layout

## Git Workflow

- Conventional Commits: `type(scope): description`. Keep the description under 50 chars (e.g., `docs: expand README`, not `docs: expand README with tech stack, commands, structure, and deployment info`). No abbreviations (write "message" not "msg"). Always create a branch per issue.
- Branch naming: `type/scope` where `type` matches the conventional commit type (e.g., `docs/pr-template-workflow`, `fix/external-link-rel`). No user prefix like `lyonsun7/`.
- Pre-commit order: `new branch` → `build` → `check` → `format`, then review `git diff`.
- After pushing, always create a PR: read `.github/pull_request_template.md`, fill it, and create with `gh pr create --title "..." --body "..."`.
- No force push; never commit without explicit approval.
- Reference Linear: `Ref: LYO-NN`.
