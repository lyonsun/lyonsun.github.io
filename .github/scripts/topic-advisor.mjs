#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, appendFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, 'topic-advisor-prompt.md');
const TOPICS_PATH = join(__dirname, 'topics.json');
const POSTS_DIR = join(__dirname, '..', '..', 'src', 'content', 'posts');

function pluralize(count) {
    return count === 1 ? 'topic' : 'topics';
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const TARGET_UNUSED = 10;

function readTopics() {
    const raw = readFileSync(TOPICS_PATH, 'utf-8');
    return JSON.parse(raw);
}

function writeTopics(topics) {
    writeFileSync(TOPICS_PATH, JSON.stringify(topics, null, 4) + '\n');
}

function getPostSlugs() {
    const files = readdirSync(POSTS_DIR);
    return files
        .filter((f) => f.endsWith('.md'))
        .map((f) => (extname(f) ? f.replace(extname(f), '') : f))
        .map((slug) => {
            const match = slug.match(/^\d{4}-\d{2}-\d{2}-(.+)/);
            return match ? match[1] : slug;
        });
}

function buildExistingContext(topics, postSlugs) {
    const used = topics.filter((t) => t.usedAt);
    const unused = topics.filter((t) => !t.usedAt);

    const lines = [];
    lines.push('Existing topic titles (already used):');
    used.forEach((t) => lines.push(`  - ${t.title}`));
    lines.push('Existing topic titles (unused — avoid these):');
    unused.forEach((t) => lines.push(`  - ${t.title}`));
    lines.push('Existing post slugs (avoid these):');
    postSlugs.forEach((s) => lines.push(`  - ${s}`));
    return lines.join('\n');
}

function validateTopic(topic, index) {
    if (!topic.slug || typeof topic.slug !== 'string') {
        throw new Error(`Topic ${index}: missing or invalid "slug"`);
    }
    if (!/^[a-z0-9-]{3,40}$/.test(topic.slug)) {
        throw new Error(
            `Topic ${index}: slug "${topic.slug}" invalid — use lowercase, hyphens, 3-40 chars`,
        );
    }
    if (!topic.title || typeof topic.title !== 'string') {
        throw new Error(`Topic ${index}: missing or invalid "title"`);
    }
    if (!topic.angle || typeof topic.angle !== 'string') {
        throw new Error(`Topic ${index}: missing or invalid "angle"`);
    }
    if (!topic.rationale || typeof topic.rationale !== 'string') {
        throw new Error(`Topic ${index}: missing or invalid "rationale"`);
    }
    if (
        !Array.isArray(topic.tags) ||
        topic.tags.length === 0 ||
        !topic.tags.every((t) => typeof t === 'string')
    ) {
        throw new Error(
            `Topic ${index}: "tags" must be a non-empty array of strings`,
        );
    }
}

function checkAIDensity(topics) {
    if (topics.length < 4) {
        return true;
    }
    const aiTags = [
        'ai',
        'llm',
        'agentic',
        'prompt-engineering',
        'coding-assistants',
    ];
    const aiCount = topics.filter((t) =>
        t.tags.some((tag) => aiTags.includes(tag)),
    ).length;
    const ratio = aiCount / topics.length;
    if (ratio < 0.4 || ratio > 0.6) {
        console.warn(
            `AI topic ratio ${(ratio * 100).toFixed(0)}% outside 40-60% range.`,
        );
        return false;
    }
    return true;
}

function isDuplicate(topic, existingTopics, postSlugs) {
    const slugMatch = existingTopics.some((t) => t.slug === topic.slug);
    const titleMatch = existingTopics.some(
        (t) => t.title.toLowerCase() === topic.title.toLowerCase(),
    );
    const angleMatch = existingTopics.some(
        (t) =>
            t.angle.toLowerCase().trim() === topic.angle.toLowerCase().trim(),
    );
    const postSlugMatch = postSlugs.includes(topic.slug);
    return slugMatch || titleMatch || angleMatch || postSlugMatch;
}

async function callGroq(count, existingContext) {
    const systemPrompt = readFileSync(PROMPT_PATH, 'utf-8').trim();
    const userPrompt = `Generate ${count} new blog post topics for my personal tech blog.

${existingContext}

No duplicates. No topics about crypto, blockchain, or mobile development.`;

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
            temperature: 0.7,
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
    const content = data.choices[0].message.content.trim();

    let topics;
    try {
        topics = JSON.parse(content);
    } catch {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            topics = JSON.parse(jsonMatch[1].trim());
        } else {
            throw new Error('Failed to parse JSON from LLM response');
        }
    }

    if (!Array.isArray(topics)) {
        throw new Error('LLM response is not an array');
    }

    return topics;
}

async function callGroqWithRetry(count, existingContext, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const generated = await callGroq(count, existingContext);

        const valid = [];
        for (let i = 0; i < generated.length; i++) {
            const topic = generated[i];
            try {
                validateTopic(topic, i);
            } catch {
                continue;
            }
            valid.push(topic);
        }

        const sameCount = valid.length === count;
        const goodDensity = sameCount && checkAIDensity(valid);

        if (sameCount && goodDensity) {
            return valid;
        }

        const reasons = [];
        if (!sameCount)
            reasons.push(`only ${valid.length}/${count} passed validation`);
        if (sameCount && !goodDensity)
            reasons.push('AI density outside 40-60% range');

        console.warn(`Attempt ${attempt}: ${reasons.join('; ')}. Retrying...`);
    }

    throw new Error(
        'Failed to generate topics meeting ratio constraints after retries',
    );
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const topics = readTopics();
    const postSlugs = getPostSlugs();

    const unusedTopics = topics.filter((t) => !t.usedAt);
    const countNeeded = TARGET_UNUSED - unusedTopics.length;

    if (countNeeded <= 0) {
        console.log(
            `Queue has ${unusedTopics.length} unused topics (target: ${TARGET_UNUSED}). No new topics needed.`,
        );
        process.exit(0);
    }

    console.log(
        `Queue has ${unusedTopics.length} unused topics. Generating ${countNeeded} new ${pluralize(countNeeded)}.`,
    );

    const existingContext = buildExistingContext(topics, postSlugs);
    const generated = await callGroqWithRetry(countNeeded, existingContext);

    const added = [];
    for (const topic of generated) {
        if (isDuplicate(topic, topics, postSlugs)) {
            console.log(
                `  Skipping duplicate: "${topic.title}" (${topic.slug})`,
            );
            continue;
        }
        topics.push({
            slug: topic.slug,
            title: topic.title,
            angle: topic.angle,
            rationale: topic.rationale,
            tags: topic.tags,
            usedAt: null,
        });
        added.push(topic);
    }

    if (added.length === 0) {
        console.log('No valid new topics generated.');
        process.exit(0);
    }

    const finalCount = topics.filter((t) => !t.usedAt).length;

    const unusedTopicsFinal = topics.filter((t) => !t.usedAt);
    if (unusedTopicsFinal.length >= 4 && !checkAIDensity(unusedTopicsFinal)) {
        console.warn(
            `Warning: Overall unused queue ratio is skewed despite batch-level check. Consider manual curation or a future generation run.`,
        );
    }

    if (dryRun) {
        console.log(
            `[dry-run] Would add ${added.length} ${pluralize(added.length)}. Final unused: ${finalCount}.`,
        );
        for (const t of added) {
            console.log(`  + ${t.title} [${t.tags.join(', ')}]`);
        }
        process.exit(0);
    }

    writeTopics(topics);
    console.log(
        `Added ${added.length} ${pluralize(added.length)}. Queue now has ${finalCount} unused topics.`,
    );
    for (const t of added) {
        console.log(`  + ${t.title} [${t.tags.join(', ')}]`);
    }

    if (process.env.GITHUB_OUTPUT) {
        appendFileSync(
            process.env.GITHUB_OUTPUT,
            `topics-added=${added.length}\n`,
        );

        const prBodyLines = [
            `This PR adds ${added.length} new ${pluralize(added.length)} to the queue, generated via LLM.`,
            '',
            '## New topics',
            ...added.map((t) => `- **${t.title}** — ${t.rationale}`),
            '',
            'Review the new topic ideas and merge if they look good.',
            'The `write-post.mjs` script will consume them on its next run.',
        ];
        const prBody = prBodyLines.join('\n');

        appendFileSync(
            process.env.GITHUB_OUTPUT,
            `pr-body<<GH_TOPIC_EOF\n${prBody}\nGH_TOPIC_EOF\n`,
        );
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
