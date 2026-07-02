#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = join(__dirname, 'revise-post-prompt.md');
const REPO_ROOT = join(__dirname, '..', '..');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

async function callGroq(postBody, errors) {
    const systemPrompt = readFileSync(PROMPT_PATH, 'utf-8').trim();

    let userPrompt = `Revise this blog post. Improve technical accuracy, add depth, fix any inaccuracies, and ensure code examples are JavaScript or TypeScript.`;

    if (errors && errors.length > 0) {
        userPrompt += `\n\nFix the following validation errors in the code examples:\n${errors.map((e) => `  - [${e.tag}] ${e.message}`).join('\n')}`;
    }

    userPrompt += `\n\n---BEGIN POST---\n${postBody}\n---END POST---`;

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
    return revised.replace(/^```[\w]*\n?|\n```$/g, '').trim();
}

function splitFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
        throw new Error('File is missing valid frontmatter');
    }
    return { frontmatter: match[1].trim(), body: match[2].trim() };
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const errorsFileIndex = args.indexOf('--errors-file');
    const errorsFile =
        errorsFileIndex !== -1 ? args[errorsFileIndex + 1] : null;
    const filePath = args.find(
        (a, i) =>
            !a.startsWith('--') &&
            (errorsFileIndex === -1 || i !== errorsFileIndex + 1),
    );

    if (!filePath) {
        console.error(
            'Usage: node .github/scripts/revise-post.mjs [--dry-run] [--errors-file <path>] <file-path>',
        );
        process.exit(1);
    }

    if (!existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    let errors = null;
    if (errorsFile && existsSync(errorsFile)) {
        const raw = readFileSync(errorsFile, 'utf-8');
        try {
            const parsed = JSON.parse(raw);
            errors = parsed.errors || parsed;
        } catch {
            console.warn(
                `Could not parse errors file: ${errorsFile}. Continuing without.`,
            );
        }
    }

    const content = readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = splitFrontmatter(content);

    console.log(`Revising: ${filePath}`);
    const revisedBody = await callGroq(body, errors);

    if (!revisedBody || revisedBody.length < 50) {
        console.warn(
            'Revision returned empty or too short — keeping original content.',
        );
        process.exit(0);
    }

    if (dryRun) {
        console.log(`[dry-run] Would revise: ${filePath}`);
        console.log('--- Revised body preview (first 200 chars) ---');
        console.log(revisedBody.slice(0, 200));
        console.log('---');
        process.exit(0);
    }

    const newContent = `---\n${frontmatter}\n---\n\n${revisedBody}\n`;
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
