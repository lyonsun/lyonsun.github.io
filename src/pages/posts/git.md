---
layout: ../../layouts/blogPost.astro
title: Git Cheatsheet
pubDate: 2025-09-28
updatedAt: 2025-09-28
description: Working with Git
---

## Need to undo a local git commit?

Sometimes, things don't go right as expected. You might have commit some code without being aware of the git configuration used for example, whether it is the wrong git user information (email or username) or the wrong git sign key for verified commits. There are two different scenarios here.

## When it was the very first local git commit

If you have only just created the code repo, made your very first git commit, you would use this to undo it:

```sh
git update-ref -d HEAD
```

## When it is a git commit after a long history

When the git history is long and you commit something that isn't really right, undo it this way:

```sh
git reset HEAD~
```

Stay tuned for more content coming soon!
