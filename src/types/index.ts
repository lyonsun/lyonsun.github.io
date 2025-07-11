export type Frontmatter = {
    title: string;
    description: string;
    pubDate: string;
};

export type Post = {
    frontmatter: Frontmatter;
    url: string;
};
