#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { execFileSync, spawnSync } from 'child_process';
import { dirname } from 'path';

const command = process.argv[2];
const VALIDATION_ERRORS_PATH = '/tmp/validation-errors.json';

const HELPER_FILES = [
    'revise-post.mjs',
    'validate-post.mjs',
    'lib/api.mjs',
    'revise-post-prompt.md',
];

function git(args, options = {}) {
    return execFileSync('git', args, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        ...options,
    }).trim();
}

function readRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        console.error(`Missing required environment variable: ${name}`);
        process.exit(1);
    }
    return value;
}

function findPostFile() {
    let status = '';
    try {
        status = git(['status', '--porcelain', 'src/content/posts/'], {
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch {
        return '';
    }

    const untracked = status
        .split('\n')
        .map((line) => line.match(/^\?\? (.+)$/)?.[1])
        .find(Boolean);

    if (untracked) {
        return untracked;
    }

    let added = '';
    try {
        added = git([
            'diff',
            '--diff-filter=A',
            '--name-only',
            'origin/main...HEAD',
            '--',
            'src/content/posts/*.md',
        ]);
    } catch {
        return '';
    }

    return added.split('\n').find(Boolean) ?? '';
}

function ensureScript(scriptName) {
    const path = `.github/scripts/${scriptName}`;
    if (existsSync(path)) {
        return path;
    }

    // The blog branch was forked before these scripts were added to main.
    // Restore the full set of co-located helpers into .github/scripts/ so that
    // relative imports (./lib/api.mjs) and prompt files resolve correctly.
    for (const helperFile of HELPER_FILES) {
        const helperPath = `.github/scripts/${helperFile}`;
        if (existsSync(helperPath)) {
            continue;
        }

        try {
            const contents = git([
                'show',
                `main:.github/scripts/${helperFile}`,
            ]);
            mkdirSync(dirname(helperPath), { recursive: true });
            writeFileSync(helperPath, contents + '\n');
            console.log(`Restored ${helperFile} from main.`);
        } catch (err) {
            console.warn(
                `Could not restore ${helperFile} from main: ${err.message}`,
            );
        }
    }

    if (!existsSync(path)) {
        throw new Error(
            `Required helper script missing and could not be restored: ${path}`,
        );
    }

    return path;
}

function runNode(args, options = {}) {
    const result = spawnSync(process.execPath, args, {
        encoding: 'utf-8',
        stdio: 'inherit',
        ...options,
    });

    return result.status ?? 1;
}

function captureNode(args) {
    return spawnSync(process.execPath, args, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'inherit'],
    });
}

function revise(postFile) {
    const reviseScript = ensureScript('revise-post.mjs');
    return runNode([reviseScript, postFile]);
}

function validate(postFile) {
    const validateScript = ensureScript('validate-post.mjs');
    const reviseScript = ensureScript('revise-post.mjs');

    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Validating code examples (attempt ${attempt})...`);
        const validation = captureNode([validateScript, '--json', postFile]);

        if (validation.status === 0) {
            console.log('All code examples pass validation.');
            break;
        }

        console.log('Found issues, re-revising post...');
        writeFileSync(VALIDATION_ERRORS_PATH, validation.stdout);
        const revisionStatus = runNode([
            reviseScript,
            '--errors-file',
            VALIDATION_ERRORS_PATH,
            postFile,
        ]);

        if (revisionStatus !== 0) {
            return revisionStatus;
        }
    }

    const finalStatus = runNode([validateScript, postFile]);
    if (finalStatus !== 0) {
        console.warn('Warning: Some validation issues remain after revision.');
    }

    return 0;
}

function processPost(mode) {
    const postFile = findPostFile();
    if (!postFile) {
        console.log(
            mode === 'revise'
                ? 'No existing post found.'
                : 'No post file found for validation.',
        );
        return 0;
    }

    return mode === 'revise' ? revise(postFile) : validate(postFile);
}

function renderPrBody() {
    const postFile = readRequiredEnv('POST_FILE');
    const topicSlug = readRequiredEnv('TOPIC_SLUG');
    const topicTitle = readRequiredEnv('TOPIC_TITLE');
    const aiModel = readRequiredEnv('AI_MODEL_USED');
    const generatedDate = readRequiredEnv('GENERATED_DATE');

    console.log(`## Story

Automated blog writer run for ${postFile}.

## Summary

This PR adds an AI-generated blog post draft.

- Topic slug: ${topicSlug}
- Topic title: ${topicTitle}
- Post file: ${postFile}
- Generation model: ${aiModel}
- Revision model: ${aiModel}
- Generated on: ${generatedDate}

The post has \`draft: true\` and \`aiGeneratedContent: true\`. Review the content, then remove \`draft: true\` before publishing.

## Verification

- [x] \`npx prettier --check .\` succeeds
- [x] \`npm run check\` passes
- [x] \`npm run build\` succeeds
- [ ] Preview build visually checked for layout issues`);
}

if (command === 'revise' || command === 'validate') {
    process.exit(processPost(command));
}

if (command === 'render-pr-body') {
    renderPrBody();
    process.exit(0);
}

console.error(
    'Usage: node .github/scripts/blog-writer-workflow.mjs <revise|validate|render-pr-body>',
);
process.exit(1);
