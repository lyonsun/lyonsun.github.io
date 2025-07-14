export type Frontmatter = {
    title: string;
    description: string;
    pubDate: string;
    author: string;
    aiGeneratedContent: boolean;
};

export type Post = {
    frontmatter: Frontmatter;
    url: string;
};
