#!/usr/bin/env node

import {
    readFileSync,
    writeFileSync,
    existsSync,
    mkdirSync,
    appendFileSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOPICS_PATH = join(__dirname, 'topics.json');
const POSTS_DIR = join(__dirname, '..', 'src', 'content', 'posts');
const REPO_ROOT = join(__dirname, '..');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'mixtral-8x7b-32768';
const SITE_AUTHOR = 'Liang Sun';

function yamlQuote(value) {
    const escaped = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

function getTodayDate() {
    return new Date().toISOString().slice(0, 10);
}

function readTopics() {
    const raw = readFileSync(TOPICS_PATH, 'utf-8');
    return JSON.parse(raw);
}

function writeTopics(topics) {
    writeFileSync(TOPICS_PATH, JSON.stringify(topics, null, 4) + '\n');
}

async function callGroq(topic) {
    const systemPrompt =
        'You are a technical blog writer for a personal portfolio site. Write concise, engaging blog posts about AI in web engineering for a seasoned full-stack web engineer audience.';

    const userPrompt = `Write a blog post about: ${topic.title}

Angle: ${topic.angle}
Tags: ${topic.tags.join(', ')}

Requirements:
- 300-500 words
- Educational, practical, and technically accurate
- Write in clear, engaging English
- Use markdown formatting for the body (headings, lists, code blocks as needed)

Respond with valid JSON only (no markdown wrapping, no trailing commas):
{
  "title": "The article title",
  "description": "One-sentence summary for the post's frontmatter description",
  "body": "Full article body in markdown format"
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.5,
            max_tokens: 2048,
        }),
        signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
        const cleaned = content
            .replace(/^```json\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();
        return JSON.parse(cleaned);
    } catch {
        const lines = content.split('\n');
        const firstHeading = lines.find((l) => l.startsWith('# '));
        const title = firstHeading
            ? firstHeading.replace(/^#\s+/, '').trim()
            : topic.title;
        const description = topic.angle.slice(0, 150);
        return { title, description, body: content };
    }
}

function generateFrontmatter({ title, description, dateStr, tags }) {
    const tagsYaml = tags.map((t) => `  - ${t}`).join('\n');
    return `---
title: ${yamlQuote(title)}
description: ${yamlQuote(description)}
pubDate: ${dateStr}
author: ${SITE_AUTHOR}
aiGeneratedContent: true
draft: true
tags:
${tagsYaml}
---
`;
}

function slugToFileName(dateStr, slug) {
    return `${dateStr}-${slug}.md`;
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const topicSlug = args.find((a) => !a.startsWith('--'));
    const topics = readTopics();

    let topicIndex;
    let topic;

    if (topicSlug) {
        topicIndex = topics.findIndex((t) => t.slug === topicSlug);
        if (topicIndex === -1) {
            console.error(`Topic "${topicSlug}" not found.`);
            process.exit(1);
        }
        topic = topics[topicIndex];
        if (topic.usedAt) {
            console.error(
                `Topic "${topicSlug}" was already used on ${topic.usedAt}.`,
            );
            process.exit(1);
        }
    } else {
        topicIndex = topics.findIndex((t) => !t.usedAt);
        if (topicIndex === -1) {
            console.log('All topics have been used. No article to generate.');
            process.exit(0);
        }
        topic = topics[topicIndex];
    }

    const dateStr = getTodayDate();
    const fileName = slugToFileName(dateStr, topic.slug);
    const filePath = join(POSTS_DIR, fileName);

    if (existsSync(filePath)) {
        console.error(`File already exists: ${fileName}`);
        process.exit(1);
    }

    console.log(`Generating article for: ${topic.title}`);
    const result = await callGroq(topic);

    if (!result.title || !result.description || !result.body) {
        console.error(
            'AI response missing required fields (title, description, or body).',
        );
        process.exit(1);
    }

    if (dryRun) {
        console.log(`[dry-run] Would write: ${filePath}`);
        console.log(`[dry-run] Title: ${result.title}`);
        console.log(`[dry-run] Topic: ${topic.slug} would be marked as used`);
        process.exit(0);
    }

    if (!existsSync(POSTS_DIR)) {
        mkdirSync(POSTS_DIR, { recursive: true });
    }

    const frontmatter = generateFrontmatter({
        title: result.title,
        description: result.description,
        dateStr,
        tags: topic.tags,
    });
    const content = frontmatter + result.body.trimEnd() + '\n';
    writeFileSync(filePath, content);
    console.log(`Written: ${filePath}`);

    topic.usedAt = dateStr;
    writeTopics(topics);
    console.log(`Updated topic queue: ${topic.slug} marked as used`);

    try {
        execSync(`npx prettier --write "${filePath}"`, {
            cwd: REPO_ROOT,
            stdio: 'inherit',
        });
        console.log('Formatted with prettier');
    } catch {
        console.warn('Prettier formatting skipped (non-fatal)');
    }

    if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, `topic-slug=${topic.slug}\n`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
