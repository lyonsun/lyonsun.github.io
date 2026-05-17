import type { APIRoute } from 'astro';

const getRobotsTxt = (sitemapUrl: URL) =>
    `User-agent: *
Allow: /

Sitemap: ${sitemapUrl.href}
`;

export const GET: APIRoute = ({ site }) => {
    if (!site) {
        return new Response('Missing site configuration', { status: 500 });
    }

    const sitemapUrl = new URL('/sitemap.xml', site);

    return new Response(getRobotsTxt(sitemapUrl), {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
    });
};
