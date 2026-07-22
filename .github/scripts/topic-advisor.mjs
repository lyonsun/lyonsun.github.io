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

const AI_API_URL =
    process.env.AI_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
const AI_TAGS = [
    'ai',
    'llm',
    'agentic',
    'prompt-engineering',
    'coding-assistants',
];

function getAiCount(topics) {
    return topics.filter((t) => t.tags.some((tag) => AI_TAGS.includes(tag)))
        .length;
}

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

function buildExistingContext(topics, postSlugs, unusedTopics) {
    const used = topics.filter((t) => t.usedAt);

    const lines = [];
    lines.push('Existing topic titles (already used):');
    used.forEach((t) => lines.push(`  - ${t.title}`));
    lines.push('Existing topic titles (unused — avoid these):');
    unusedTopics.forEach((t) => lines.push(`  - ${t.title}`));
    lines.push('Existing post slugs (avoid these):');
    postSlugs.forEach((s) => lines.push(`  - ${s}`));

    if (unusedTopics.length > 0) {
        const ratio = getAiCount(unusedTopics) / unusedTopics.length;
        lines.push('');
        lines.push(
            `Note: Current unused queue is ${(ratio * 100).toFixed(0)}% AI/LLM topics.`,
        );
    }

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
    const ratio = getAiCount(topics) / topics.length;
    if (ratio > 0.6) {
        console.warn(
            `AI topic ratio ${(ratio * 100).toFixed(0)}% exceeds 60% threshold.`,
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

async function callAI(count, existingContext, maxAiTopics, forceNoAi = false) {
    const systemPrompt = readFileSync(PROMPT_PATH, 'utf-8').trim();
    const userPrompt = forceNoAi
        ? `Generate ${count} new blog post topics for my personal tech blog.

${existingContext}

Constraints:
- NONE of the ${count} topics may be about AI, LLMs, machine learning,
  prompt engineering, agentic systems, or any AI-related topic. Every single
  topic must be from other software engineering areas only. If even one topic
  has AI/LLM tags, the entire batch will be rejected and discarded.
- No duplicates. No topics about crypto, blockchain, or mobile development.`
        : `Generate ${count} new blog post topics for my personal tech blog.

${existingContext}

Constraints:
- At most ${maxAiTopics} of the ${count} topics may be about AI or LLMs.
- No duplicates. No topics about crypto, blockchain, or mobile development.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.AI_API_KEY}`,
        },
        body: JSON.stringify({
            model: AI_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 2048,
        }),
        signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API error (${response.status}): ${errorText}`);
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

async function callAIWithRetry(
    count,
    existingContext,
    unusedTopics,
    allTopics,
    postSlugs,
    maxRetries = 3,
) {
    const currentAiRatio =
        unusedTopics.length > 0
            ? getAiCount(unusedTopics) / unusedTopics.length
            : 0;

    let maxAiTopics;
    if (currentAiRatio >= 0.6) {
        maxAiTopics = 0;
    } else if (currentAiRatio >= 0.5) {
        maxAiTopics = Math.max(0, Math.floor(count * 0.25));
    } else {
        maxAiTopics = Math.ceil(count * 0.5);
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const generated = await callAI(
            count,
            existingContext,
            maxAiTopics,
            maxAiTopics === 0,
        );

        const valid = [];
        for (let i = 0; i < generated.length; i++) {
            const topic = generated[i];
            try {
                validateTopic(topic, i);
            } catch {
                continue;
            }
            if (isDuplicate(topic, allTopics, postSlugs)) {
                continue;
            }
            valid.push(topic);
        }

        const sameCount = valid.length === count;
        const batchAiCount = getAiCount(valid);
        const batchWithinLimit = batchAiCount <= maxAiTopics;

        const projectedUnused = [...unusedTopics, ...valid];
        const cumulativeAiRatio =
            getAiCount(projectedUnused) / projectedUnused.length;
        const cumulativeOk = cumulativeAiRatio <= 0.6;

        if (sameCount && batchWithinLimit && cumulativeOk) {
            return valid;
        }

        const reasons = [];
        if (!sameCount) {
            reasons.push(`only ${valid.length}/${count} passed validation`);
        }
        if (sameCount && !batchWithinLimit) {
            reasons.push(
                `batch has ${batchAiCount} AI topics (limit ${maxAiTopics})`,
            );
        }
        if (sameCount && batchWithinLimit && !cumulativeOk) {
            reasons.push(
                `cumulative AI ratio would be ${(cumulativeAiRatio * 100).toFixed(0)}% (max 60%)`,
            );
        }

        console.warn(`Attempt ${attempt}: ${reasons.join('; ')}. Retrying...`);
    }

    throw new Error(
        'Failed to generate valid non-duplicate topics after retries',
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

    const existingContext = buildExistingContext(
        topics,
        postSlugs,
        unusedTopics,
    );
    const generated = await callAIWithRetry(
        countNeeded,
        existingContext,
        unusedTopics,
        topics,
        postSlugs,
    );

    const added = [];
    for (const topic of generated) {
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

    const finalCount = topics.filter((t) => !t.usedAt).length;

    checkAIDensity(topics.filter((t) => !t.usedAt));

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
