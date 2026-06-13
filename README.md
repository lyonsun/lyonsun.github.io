# Personal website

Personal portfolio and blog built with [Astro](https://astro.build/), deployed to [GitHub Pages](https://lyonsun.github.io).

## Tech stack

- **Astro** v6 — static site generation
- **Tailwind CSS** v4 — utility-first styling (via `@tailwindcss/vite`)
- **TypeScript** — strict mode (`astro/tsconfigs/strict`)
- **Content** — Markdown blog posts with Zod-validated frontmatter (`glob` loader)
- **Formatting** — Prettier (`prettier-plugin-astro`, `prettier-plugin-tailwindcss`)
- **Deployment** — GitHub Pages via GitHub Actions

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
src/
├── components/       # Atomic design: atoms/, elements/, sections/, icons/
├── content/posts/    # Blog posts (Markdown with frontmatter)
├── layouts/          # layout.astro, blogPost.astro
├── lib/              # Helpers (posts.ts, url.ts)
├── meta/             # GA4 analytics
├── pages/            # Routes (index, 404, posts/*, rss.xml, etc.)
├── styles/           # global.css
├── assets/           # og-image.png
└── content.config.ts # Zod schema for posts
```

## Content

Blog posts live in `src/content/posts/` as Markdown files with frontmatter:

- `title` (required), `description` (required), `pubDate` (required)
- `tags` (optional, default `[]`), `author`, `updatedAt`, `draft`, `aiGeneratedContent`

Titles use sentence case.

## Deployment

Push to `main` → automatically built and deployed to GitHub Pages via GitHub Actions (Node 24, `npm ci`).

## Live

https://lyonsun.github.io
