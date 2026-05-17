import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE_DESCRIPTION, SITE_NAME } from '../consts';
import { getPublishedPosts } from '../lib/posts';

export const GET: APIRoute = async (context) => {
    if (!context.site) {
        return new Response('Missing site configuration', { status: 500 });
    }

    const posts = await getPublishedPosts();

    return rss({
        title: SITE_NAME,
        description: SITE_DESCRIPTION,
        site: context.site,
        items: posts.map((post) => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.pubDate,
            link: `/posts/${post.id}/`,
        })),
        customData: `<language>en-us</language>`,
    });
};
