#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

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

function extractDescription(body) {
    const firstPara = body
        .split('\n\n')
        .find((p) => p.trim().length > 0 && !p.trim().startsWith('#'));
    if (!firstPara) return '';

    const truncated = truncateAtSentence(firstPara, 150);
    const sanitized = truncated.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    return /[.!?]$/.test(sanitized) ? sanitized : sanitized + '.';
}

function yamlQuote(value) {
    const escaped = String(value)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');
    return `"${escaped}"`;
}

function parseFrontmatter(raw) {
    const fields = {};
    for (const line of raw.split('\n')) {
        const match = line.match(/^(\w+):\s*(.*)$/);
        if (match) {
            let value = match[2];
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            fields[match[1]] = value;
        }
    }
    return fields;
}

function rebuildFrontmatter(fields, tagsRaw) {
    const tagsYaml = fields.tags ? tagsRaw : '';
    const parts = [];
    for (const key of [
        'title',
        'description',
        'pubDate',
        'author',
        'aiGeneratedContent',
        'draft',
    ]) {
        if (fields[key] !== undefined) {
            if (key === 'title' || key === 'description') {
                parts.push(`${key}: ${yamlQuote(fields[key])}`);
            } else {
                parts.push(`${key}: ${fields[key]}`);
            }
        }
    }
    if (fields.updatedAt !== undefined) {
        parts.push(`updatedAt: ${fields.updatedAt}`);
    }
    if (tagsYaml) {
        parts.push('tags:');
        parts.push(tagsYaml);
    }
    return parts.join('\n');
}

function splitFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        throw new Error('File is missing valid frontmatter');
    }
    return { frontmatter: match[1].trim(), body: match[2].trim() };
}

function getTagsYaml(frontmatter) {
    const lines = frontmatter.split('\n');
    const tagLines = [];
    let inTags = false;
    for (const line of lines) {
        if (line.trim() === 'tags:') {
            inTags = true;
            continue;
        }
        if (inTags) {
            if (line.startsWith('  - ')) {
                tagLines.push(line);
            } else {
                break;
            }
        }
    }
    return tagLines.join('\n');
}

async function callGroq(postBody) {
    const systemPrompt =
        'You are a technical blog editor. Revise the given blog post to be more technically accurate, deeper, and clearer. Keep the same overall structure and length (300-500 words). Use JavaScript or TypeScript for all code examples. All code examples must use ESM/import syntax (not CommonJS require). Avoid patterns with obvious security issues (shell injection via exec, etc.). Do not change the topic or angle. Do not wrap the output in code fences. Return only the revised markdown body — no title, no metadata.';

    const userPrompt = `Revise this blog post. Improve technical accuracy, add depth, fix any inaccuracies, and ensure code examples are JavaScript or TypeScript.

---BEGIN POST---
${postBody}
---END POST---`;

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
            temperature: 0.3,
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
    const revised = data.choices[0].message.content.trim();
    return revised.replace(/^```[\w]*\n?|```$/g, '').trim();
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const filePath = args.find((a) => !a.startsWith('--'));

    if (!filePath) {
        console.error(
            'Usage: node scripts/revise-post.mjs [--dry-run] <file-path>',
        );
        process.exit(1);
    }

    if (!existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = splitFrontmatter(content);

    console.log(`Revising: ${filePath}`);
    const revisedBody = await callGroq(body);

    if (!revisedBody || revisedBody.length < 50) {
        throw new Error('Revision returned empty or too short — discarding.');
    }

    if (dryRun) {
        console.log(`[dry-run] Would revise: ${filePath}`);
        console.log('--- Revised body preview (first 200 chars) ---');
        console.log(revisedBody.slice(0, 200));
        console.log('---');
        process.exit(0);
    }

    const today = new Date().toISOString().slice(0, 10);

    const fields = parseFrontmatter(frontmatter);
    const tagsRaw = getTagsYaml(frontmatter);

    const newDescription = extractDescription(revisedBody);
    if (newDescription) {
        fields.description = newDescription;
    }

    fields.updatedAt = today;

    const tagsBlock = tagsRaw ? `\n${tagsRaw}` : '';
    const rebuiltFrontmatter = `---\n${rebuildFrontmatter(fields, tagsRaw)}${tagsBlock}\n---`;

    const newContent = `${rebuiltFrontmatter}\n\n${revisedBody}\n`;
    writeFileSync(filePath, newContent);

    try {
        execSync(`npx prettier --write "${filePath}"`, {
            cwd: REPO_ROOT,
            stdio: 'inherit',
        });
    } catch {
        console.warn('Prettier formatting skipped (non-fatal)');
    }

    console.log(`Revised: ${filePath}`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
