# Project Overview

This is a personal portfolio/blog website built with **Astro v6**, deployed to GitHub Pages at `https://lyonsun.github.io`.

## Tech Stack

- **Framework**: Astro v6
- **Styling**: Tailwind CSS v4 (via Vite plugin)
- **Language**: TypeScript (strict mode)
- **Content**: Markdown blog posts with Zod schema validation
- **Formatting**: Prettier (Astro + Tailwind plugins)
- **Package Manager**: npm
- **Deployment**: GitHub Pages (GitHub Actions)
- **Dependency Updates**: Renovate Bot

## Project Structure

```
src/
├── components/          # UI components (atomic design: atoms, elements, sections, icons)
├── content/posts/       # Blog posts (Markdown)
├── layouts/             # Page layouts (layout.astro, blogPost.astro)
├── lib/                 # Utilities (posts.ts, url.ts)
├── meta/                # Analytics (ga4.astro)
├── pages/               # Routes (index, 404, posts, sitemap, rss, robots.txt)
├── content.config.ts    # Content collection schema (Zod)
└── consts.ts            # Site-level constants
```

---

# Development Setup

## Prerequisites

- Node.js 22+
- npm

## Getting Started

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npx astro check      # Type-check the project
```

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Astro dev server |
| `npm run build` | Build static site for production |
| `npm run preview` | Preview production build locally |
| `npm run astro` | Run Astro CLI commands directly |
| `npx astro check` | Type-check with `@astrojs/check` |

---

# Code Conventions

## Formatting (Prettier)

- Print width: 80 characters
- Tab width: **4 spaces**
- Semicolons: required
- Single quotes: enabled for JS/TS/Astro
- Trailing commas: `all`
- Line endings: `lf` (Unix-style)
- Plugins: `prettier-plugin-astro`, `prettier-plugin-tailwindcss`

## TypeScript

- Strict mode enabled (`astro/tsconfigs/strict`)
- No `any` types unless absolutely necessary
- Use Zod schemas for content validation (`src/content.config.ts`)

## Astro Conventions

- Components use `.astro` extension
- Use frontmatter (`---`) for component logic
- Keep components small and focused
- Follow atomic design pattern (atoms → elements → sections)
- Blog posts are Markdown files in `src/content/posts/`

## Adding Blog Posts

1. Create a new `.md` file in `src/content/posts/`
2. Include required frontmatter: `title`, `description`, `pubDate`, `tags`
3. Schema is defined in `src/content.config.ts` (Zod validation)

---

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
- Run `npx astro check` for type-checking
- Run Prettier formatting (auto-applied if configured)
- Review `git diff` before staging
- **Never force push** — use `git commit --fixup` or a separate commit instead of amending

## Branches

- **Always create a new branch per issue** — never work directly on main
- Follow Conventional Commits naming: `<type>/<short-description>` (e.g., `perf/optimize-fonts`, `fix/broken-link`)
- Keep branches focused on a single change

## Pull Requests

- **Always create a PR** — no direct commits to main
- PR title should match the Conventional Commits format
- Include a brief description of what changed and why
- Reference Linear issue numbers when applicable (e.g., `Ref: LYO-24`)

## Linear Integration

- When working on a Linear issue, mention it in commits: `Ref: LYO-NN`
- Update issue status when work is complete
