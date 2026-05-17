const getTagPath = (tag: string) => `/posts/tags/${encodeURIComponent(tag)}/`;

export { getTagPath };
