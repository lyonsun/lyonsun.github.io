import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.coerce.date(),
        updatedAt: z.coerce.date().optional(),
        author: z.string().optional(),
        aiGeneratedContent: z.boolean().default(false),
        draft: z.boolean().default(false),
        tags: z.array(z.string()).default([]),
    }),
});

export const collections = { posts };
