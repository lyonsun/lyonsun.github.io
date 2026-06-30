# Personal website

Personal portfolio and blog built with [Astro](https://astro.build/), deployed to [GitHub Pages](https://lyonsun.github.io).

## Tech stack

- **Astro** v7 — static site generation
- **Tailwind CSS** v4 — utility-first styling (via `@tailwindcss/vite`)
- **TypeScript** — strict mode (`astro/tsconfigs/strict`)
- **Content** — Markdown blog posts with Zod-validated frontmatter (`glob` loader)
- **Formatting** — Prettier with `prettier-plugin-astro` and `prettier-plugin-tailwindcss`
- **Deployment** — GitHub Pages via GitHub Actions (Node 24, `npm ci`)

## Commands

| Command           | Description                |
| ----------------- | -------------------------- |
| `npm run dev`     | Start dev server           |
| `npm run build`   | Build to `dist/`           |
| `npm run preview` | Preview production build   |
| `npm run check`   | Type check (`astro check`) |
| `npm run format`  | Format with Prettier       |

## Project structure

```
.
├── src/
│   ├── assets/          # og-image.png
│   ├── components/
│   │   ├── atoms/       # Smallest reusable (externalLink, skipLink, tagLink)
│   │   ├── elements/    # Composed atoms (postItem)
│   │   ├── icons/       # Decorative SVGs (email, github, linkedin, etc.)
│   │   └── sections/    # Page sections (hero, pageSection)
│   ├── content/
│   │   └── posts/       # Blog posts (Markdown with frontmatter)
│   ├── layouts/         # layout.astro, blogPost.astro
│   ├── lib/             # Helpers (posts.ts, url.ts)
│   ├── meta/            # GA4 analytics
│   ├── pages/           # Routes (index, 404, posts/*, rss.xml, etc.)
│   └── styles/          # global.css
├── public/
│   ├── fonts/           # Self-hosted Saira variable font
│   └── favicon.svg
├── .github/
│   ├── workflows/       # CI (astro, lighthouse, review, blog-writer, topic-advisor)
│   ├── scripts/         # Blog generation & validation scripts
│   └── pull_request_template.md
├── astro.config.ts
├── content.config.ts    # Zod schema for blog posts
├── tsconfig.json
├── .prettierrc.json     # 4-space tabs, single quotes, trailing commas
├── renovate.json        # Automated dependency updates
├── opencode.json        # OpenCode AI tooling config
├── lighthouse-budget.json
└── lighthouserc.json
```

## Content

Blog posts live in `src/content/posts/` as Markdown files with frontmatter:

- `title` (required), `description` (required), `pubDate` (required)
- `tags` (optional, default `[]`), `author`, `updatedAt`, `draft`, `aiGeneratedContent`

Titles use sentence case.

## Deployment

Push to `main` → automatically built and deployed to GitHub Pages via GitHub Actions.

## Live

https://lyonsun.github.io

## See also

- [`AGENTS.md`](./AGENTS.md) — detailed project configuration, CI workflows, code conventions, and git workflow
