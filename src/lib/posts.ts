import { getCollection, type CollectionEntry } from 'astro:content';

const comparePostsByDateDesc = (
    a: CollectionEntry<'posts'>,
    b: CollectionEntry<'posts'>,
) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf();

async function getPublishedPosts() {
    const posts = await getCollection('posts', ({ data }) => !data.draft);

    return posts.sort(comparePostsByDateDesc);
}

async function getPublishedPostsByTag(tag: string) {
    const posts = await getPublishedPosts();

    return posts.filter((post) => post.data.tags.includes(tag));
}

async function getAllPublishedTags() {
    const posts = await getPublishedPosts();
    const tags = new Set<string>();

    for (const post of posts) {
        for (const tag of post.data.tags) {
            tags.add(tag);
        }
    }

    return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

export { getPublishedPosts, getPublishedPostsByTag, getAllPublishedTags };
