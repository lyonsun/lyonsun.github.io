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
import { callAIWithRetry, AI_MODEL } from './lib/api.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, 'write-post-prompt.md');
const TOPICS_PATH = join(__dirname, 'topics.json');
const POSTS_DIR = join(__dirname, '..', '..', 'src', 'content', 'posts');
const REPO_ROOT = join(__dirname, '..', '..');

const MODEL_PROVIDERS = {
    llama: 'Meta',
    'meta-llama': 'Meta',
    gemma: 'Google',
    gemini: 'Google',
    mixtral: 'Mistral',
    qwen: 'Alibaba',
    deepseek: 'DeepSeek',
};

function normalizeModelName(model) {
    const slashIdx = model.indexOf('/');
    const colonIdx = model.lastIndexOf(':');
    let provider = '';
    let name = model;
    if (slashIdx !== -1) {
        provider = model.slice(0, slashIdx);
        name = model.slice(slashIdx + 1);
    }
    if (colonIdx !== -1) {
        name = name.split(':')[0];
    }
    return { provider, name };
}

const normalized = normalizeModelName(AI_MODEL);
const provider = MODEL_PROVIDERS[normalized.provider] ?? '';
const modelName = normalized.name
    .replace(/-versatile|-instruct|-instant|-preview/g, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
const SITE_AUTHOR = [provider, modelName].filter(Boolean).join(' ');

function truncateAtSentence(text, max) {
    const trimmed = text.replace(/[*_#]/g, '').replace(/\n/g, ' ').trim();
    if (trimmed.length <= max) return trimmed;

    const slice = trimmed.slice(0, max);
    const sentEnd = Math.max(
        slice.lastIndexOf('. '),
        slice.lastIndexOf('! '),
        slice.lastIndexOf('? '),
        slice.lastIndexOf('.\n'),
        slice.lastIndexOf('!\n'),
        slice.lastIndexOf('?\n'),
    );
    if (sentEnd > 60) return slice.slice(0, sentEnd + 1);

    const space = slice.lastIndexOf(' ');
    if (space > 60) return slice.slice(0, space);

    return slice;
}

function yamlQuote(value) {
    const escaped = String(value)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');
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

async function callAI(topic) {
    const systemPrompt = readFileSync(PROMPT_PATH, 'utf-8').trim();

    const rationaleLines = topic.rationale
        ? `\nRationale: ${topic.rationale}`
        : '';

    const userPrompt = `Write a blog post about: ${topic.title}

Angle: ${topic.angle}
Tags: ${topic.tags.join(', ')}${rationaleLines}

Requirements:
- 300-500 words
- Educational, practical, and technically accurate
- Write in clear, engaging English
- Use markdown formatting (headings, lists, code blocks as needed)
- Include at least one concrete, practical example (e.g., code snippet, CLI command, real-world scenario, or comparison) to illustrate the key point`;

    let raw = await callAIWithRetry({
        systemPrompt,
        userPrompt,
        temperature: 0.5,
    });
    raw = raw.replace(/^```[\w]*\n?|```$/g, '').trim();

    let description;
    let body;

    const descMatch = raw.match(/<description>([\s\S]*?)<\/description>/);
    if (descMatch) {
        description = descMatch[1].trim();
        body = raw.replace(/<description>[\s\S]*?<\/description>/, '').trim();
    } else {
        const firstPara = raw.split('\n\n').find((p) => p.trim().length > 0);
        description = firstPara
            ? truncateAtSentence(firstPara, 150)
            : truncateAtSentence(topic.angle, 150);
        body = raw;
    }

    const sanitized = description
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const finalDescription = /[.!?]$/.test(sanitized)
        ? sanitized
        : sanitized + '.';

    return { title: topic.title, description: finalDescription, body };
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

function slugToFileName(slug) {
    return `${slug}.md`;
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
        const unusedIndices = topics
            .map((t, i) => ({ t, i }))
            .filter(({ t }) => !t.usedAt)
            .map(({ i }) => i);
        if (unusedIndices.length === 0) {
            console.log('All topics have been used. No article to generate.');
            process.exit(0);
        }
        topicIndex =
            unusedIndices[Math.floor(Math.random() * unusedIndices.length)];
        topic = topics[topicIndex];
    }

    const dateStr = getTodayDate();
    const fileName = slugToFileName(topic.slug);
    const filePath = join(POSTS_DIR, fileName);

    if (existsSync(filePath)) {
        console.error(`File already exists: ${fileName}`);
        process.exit(1);
    }

    console.log(`Generating article for: ${topic.title}`);
    const result = await callAI(topic);

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
        execSync(`npx prettier --write "${filePath}" "${TOPICS_PATH}"`, {
            cwd: REPO_ROOT,
            stdio: 'inherit',
        });
        console.log('Formatted with prettier');
    } catch {
        console.warn('Prettier formatting skipped (non-fatal)');
    }

    if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, `topic-slug=${topic.slug}\n`);
        appendFileSync(
            process.env.GITHUB_OUTPUT,
            `topic-title=${topic.title.replace(/\n/g, ' ')}\n`,
        );
        appendFileSync(
            process.env.GITHUB_OUTPUT,
            `post-file=src/content/posts/${fileName}\n`,
        );
        appendFileSync(process.env.GITHUB_OUTPUT, `ai-model=${AI_MODEL}\n`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
