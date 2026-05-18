import type { APIRoute } from 'astro';
import { getAllPublishedTags, getPublishedPosts } from '../lib/posts';
import { getTagPath } from '../lib/url';

const escapeXml = (value: string) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');

const toAbsoluteUrl = (site: URL, pathname: string) =>
    new URL(pathname, site).toString();

const getSitemapXml = (
    site: URL,
    pages: Array<{ url: string; lastmod?: Date }>,
) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
    .map(
        (page) => `
  <url>
    <loc>${escapeXml(toAbsoluteUrl(site, page.url))}</loc>${
        page.lastmod
            ? `
    <lastmod>${page.lastmod.toISOString()}</lastmod>`
            : ''
    }
  </url>`,
    )
    .join('\n')}
</urlset>
`;

export const GET: APIRoute = async ({ site }) => {
    if (!site) {
        return new Response('Missing site configuration', { status: 500 });
    }

    const [posts, tags] = await Promise.all([
        getPublishedPosts(),
        getAllPublishedTags(),
    ]);

    const pages = [
        { url: '/' },
        { url: '/posts/' },
        ...posts.map((post) => ({
            url: `/posts/${post.id}/`,
            lastmod: post.data.updatedAt ?? post.data.pubDate,
        })),
        ...tags.map((tag) => ({
            url: getTagPath(tag),
        })),
    ];

    return new Response(getSitemapXml(site, pages), {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
        },
    });
};
