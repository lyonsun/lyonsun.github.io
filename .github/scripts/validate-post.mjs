#!/usr/bin/env node

/**
 * Validates AI-generated blog posts for common code correctness issues:
 * - Top-level `await` without async wrapper
 * - Undefined function/variable references in code blocks
 * - Suspicious SDK API patterns (non-existent methods, wrong constructors)
 *
 * Usage: node validate-post.mjs <file-path>
 * Exit code: 0 if valid, 1 if issues found.
 */

import { readFileSync, existsSync } from 'fs';

const JS_KEYWORDS = [
    'async',
    'await',
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'export',
    'extends',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'let',
    'new',
    'of',
    'return',
    'static',
    'super',
    'switch',
    'this',
    'throw',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield',
];

const JS_BUILTINS = new Set([
    ...JS_KEYWORDS,
    'AbortController',
    'AbortSignal',
    'Array',
    'ArrayBuffer',
    'Atomics',
    'BigInt',
    'BigInt64Array',
    'BigUint64Array',
    'Blob',
    'Boolean',
    'Buffer',
    'clearImmediate',
    'clearInterval',
    'clearTimeout',
    'console',
    'Crypto',
    'crypto',
    'DataView',
    'Date',
    'decodeURI',
    'decodeURIComponent',
    'encodeURI',
    'encodeURIComponent',
    'Error',
    'EvalError',
    'Event',
    'EventTarget',
    'fetch',
    'File',
    'Float32Array',
    'Float64Array',
    'FormData',
    'globalThis',
    'Headers',
    'Infinity',
    'Int8Array',
    'Int16Array',
    'Int32Array',
    'Intl',
    'isFinite',
    'isNaN',
    'JSON',
    'Map',
    'Math',
    'MessageChannel',
    'MessageEvent',
    'MessagePort',
    'NaN',
    'Number',
    'Object',
    'parseFloat',
    'parseInt',
    'Performance',
    'performance',
    'process',
    'Promise',
    'Proxy',
    'queueMicrotask',
    'RangeError',
    'ReferenceError',
    'Reflect',
    'RegExp',
    'Request',
    'Response',
    'setImmediate',
    'setInterval',
    'setTimeout',
    'SharedArrayBuffer',
    'String',
    'structuredClone',
    'Symbol',
    'SyntaxError',
    'TextDecoder',
    'TextEncoder',
    'TypeError',
    'Uint8Array',
    'Uint8ClampedArray',
    'Uint16Array',
    'Uint32Array',
    'URIError',
    'URL',
    'URLSearchParams',
    'WeakMap',
    'WeakRef',
    'WeakSet',
    'WebSocket',
    'WritableStream',
    'ReadableStream',
    'TransformStream',
]);

const SUSPICIOUS_API_PATTERNS = [
    {
        pattern: /api\.openai\.com/g,
        message:
            'Uses direct OpenAI endpoint. Use Groq\'s endpoint (`https://api.groq.com/openai/v1`) instead.',
        tag: 'suspicious-api',
    },
    {
        pattern: /createCompletion\s*\(/g,
        message:
            '`createCompletion` is deprecated. Use `chat.completions.create()`.',
        tag: 'suspicious-api',
    },
    {
        pattern: /\.generate\(\s*\)/g,
        message:
            '`.generate()` does not exist on PromptTemplate. Use `.pipe(model).invoke()` instead.',
        tag: 'suspicious-api',
    },
    {
        pattern: /new\s+PromptTemplate\s*\(/g,
        message:
            'PromptTemplate uses `fromTemplate()`, not `new PromptTemplate()`.',
        tag: 'suspicious-api',
    },
    {
        pattern: /\.run\(\s*\)/g,
        message:
            '`.run()` may not exist. Check the SDK docs — most LangChain objects use `.invoke()`.',
        tag: 'suspicious-api',
    },
    {
        pattern: /from\s+["']@langchain\/core["']\s*;/g,
        message:
            'Import from `@langchain/core` directly is incorrect. Use `@langchain/core/prompts`, `@langchain/core/output_parsers`, etc.',
        tag: 'wrong-import',
    },
];

function main() {
    const args = process.argv.slice(2);
    const filePath = args.find((a) => !a.startsWith('--'));

    if (!filePath) {
        console.error(
            'Usage: node .github/scripts/validate-post.mjs [--json] <file-path>',
        );
        process.exit(1);
    }

    if (!existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const content = readFileSync(filePath, 'utf-8');
    const codeBlocks = extractCodeBlocks(content);
    const allErrors = [];

    for (const block of codeBlocks) {
        const errors = validateCodeBlock(block);
        allErrors.push(...errors);
    }

    const useJson = args.includes('--json');

    if (allErrors.length > 0) {
        if (useJson) {
            console.log(JSON.stringify({ valid: false, errors: allErrors }));
        } else {
            console.error(
                `\u2716 Found ${allErrors.length} issue(s) in code examples:\n`,
            );
            for (const err of allErrors) {
                console.error(
                    `  [${err.tag}] Line ~${err.line}: ${err.message}`,
                );
            }
            console.error(
                '\nFix these issues and re-run validation before publishing.',
            );
        }
        process.exit(1);
    }

    if (useJson) {
        console.log(JSON.stringify({ valid: true, errors: [] }));
    } else {
        console.log('\u2714 All code examples pass validation.');
    }
    process.exit(0);
}

function extractCodeBlocks(markdown) {
    const blocks = [];
    const validLangs = new Set(['javascript', 'js', 'typescript', 'ts']);

    // First pass: warn about code blocks with non-standard languages
    const allFenceRe = /```(\w*)\s*\n[\s\S]*?```/g;
    let match;
    while ((match = allFenceRe.exec(markdown)) !== null) {
        const lang = match[1];
        if (lang && !validLangs.has(lang)) {
            const lineNum = markdown.slice(0, match.index).split('\n').length;
            console.warn(
                `Line ~${lineNum}: Code block with language "${lang}" skipped (only js/ts blocks are validated).`,
            );
        }
    }

    // Second pass: extract JS/TS blocks for validation
    const regex = /```(javascript|js|typescript|ts)\s*\n([\s\S]*?)```/g;
    while ((match = regex.exec(markdown)) !== null) {
        const lineNum = markdown.slice(0, match.index).split('\n').length;
        blocks.push({
            lang: match[1],
            code: match[2],
            startLine: lineNum,
        });
    }

    return blocks;
}

function validateCodeBlock(block) {
    const { code, startLine } = block;
    const errors = [];

    // 1. Top-level await without async wrapper
    if (hasTopLevelAwait(code)) {
        errors.push({
            line: startLine,
            message:
                'Top-level `await` without async wrapper. Wrap the code in `(async () => { ... })()`.',
            tag: 'top-level-await',
        });
    }

    // 2. Undefined function/variable references
    const undefinedRefs = findUndefinedReferences(code);
    for (const ref of undefinedRefs) {
        errors.push({
            line: startLine,
            message: `\`${ref}\` is referenced but never defined in the code block. Define it or import it.`,
            tag: 'undefined-ref',
        });
    }

    // 3. Suspicious SDK API patterns
    for (const { pattern, message, tag } of SUSPICIOUS_API_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(code)) {
            errors.push({
                line: startLine,
                message,
                tag,
            });
        }
    }

    return errors;
}

function hasTopLevelAwait(code) {
    if (!/\bawait\b/.test(code)) return false;

    const trimmed = code.trim();

    // Check for async IIFE wrapper: (async () => { ... })() or (async function() { ... })()
    if (/^\(async\s*(\(\))?\s*(=>)?\s*\{[\s\S]*\}\)\s*\(\)/.test(trimmed)) {
        return false;
    }

    // Track brace depth: if await appears at depth 0, it's top-level
    // Strip comments and strings to avoid brace counting inside them
    const cleaned = code
        .replace(/\/\/.*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/'[^']*'/g, "''")
        .replace(/"[^"]*"/g, '""')
        .replace(/`[^`]*`/g, '``');

    let depth = 0;
    let i = 0;
    while (i < cleaned.length) {
        const ch = cleaned[i];
        if (ch === '{') depth++;
        if (ch === '}') depth--;

        if (cleaned.slice(i).match(/^\bawait\b/)) {
            if (depth === 0) return true;
            i += 5;
            continue;
        }
        i++;
    }

    return false;
}

function findUndefinedReferences(code) {
    const defined = new Set(JS_BUILTINS);

    // Strip comments and string contents to avoid false positives
    const cleaned = code
        .replace(/\/\/.*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/'[^']*'/g, "''")
        .replace(/"[^"]*"/g, '""')
        .replace(/`[^`]*`/g, '``');

    // --- Collect defined names ---

    // import { X, Y as Z } from '...'
    let m;
    const importNamedRe = /import\s+\{\s*([^}]+)\s*\}\s*from/g;
    while ((m = importNamedRe.exec(cleaned)) !== null) {
        for (const part of m[1].split(',')) {
            const name = part
                .trim()
                .split(/\s+as\s+/)
                .pop()
                .trim();
            if (name) defined.add(name);
        }
    }

    // import X from '...'
    const importDefaultRe = /import\s+(\w+)\s+from/g;
    while ((m = importDefaultRe.exec(cleaned)) !== null) {
        defined.add(m[1]);
    }

    // import * as X from '...'
    const importNsRe = /import\s+\*\s+as\s+(\w+)\s+from/g;
    while ((m = importNsRe.exec(cleaned)) !== null) {
        defined.add(m[1]);
    }

    // const X = ..., let X = ..., var X = ...
    const declRe = /(?:const|let|var)\s+(\w+)\s*=/g;
    while ((m = declRe.exec(cleaned)) !== null) {
        defined.add(m[1]);
    }

    // const { a, b: c } = ...
    const destructureRe = /(?:const|let|var)\s+\{\s*([^}]+)\s*\}\s*=/g;
    while ((m = destructureRe.exec(cleaned)) !== null) {
        for (const part of m[1].split(',')) {
            const name = part.trim().split(':').pop().trim();
            if (name) defined.add(name);
        }
    }

    // function X(...)
    const fnDeclRe = /(?:async\s+)?function\s+(\w+)\s*\(/g;
    while ((m = fnDeclRe.exec(cleaned)) !== null) {
        defined.add(m[1]);
    }

    // class X
    const classRe = /class\s+(\w+)/g;
    while ((m = classRe.exec(cleaned)) !== null) {
        defined.add(m[1]);
    }

    // ES6 method shorthand in objects/classes: { method() { ... } }
    const methodShorthandRe = /(?:^|[,\{]\s*)(\w+)\s*\([^)]*\)\s*\{/g;
    while ((m = methodShorthandRe.exec(cleaned)) !== null) {
        if (m[1]) defined.add(m[1]);
    }

    // function parameters: function (a, b) and async function (a, b) and arrow (a, b) => and a =>
    const paramsRe =
        /(?:async\s+)?(?:function\s*(?:\w+)?|(?:\([^)]*\)|\w+)\s*(?:=>))/g;
    let execResult;
    while ((execResult = paramsRe.exec(cleaned)) !== null) {
        const matchToken = execResult[0];
        // Single-param arrow: `x =>` or `async x =>` (no parens around the param)
        if (matchToken.includes('=>') && !matchToken.includes('(')) {
            const name = matchToken
                .replace(/^(?:async\s+)?/, '')
                .split(/\s*=>/)[0]
                .trim();
            if (name && /^\w+$/.test(name)) defined.add(name);
            continue;
        }
        const fnMatch = cleaned.slice(execResult.index).match(/\(([^)]*)\)/);
        if (fnMatch) {
            for (const param of fnMatch[1].split(',')) {
                const name = param
                    .trim()
                    .split(/\s*=\s*/)[0]
                    .trim()
                    .split(':')[0]
                    .trim();
                if (name && /^\w+$/.test(name)) defined.add(name);
            }
        }
    }

    // --- Find undefined function calls ---
    // Match: identifier( where identifier is not preceded by a dot (member call)
    const callRe = /(\b\w+)\s*\(/g;
    const refs = new Set();

    while ((m = callRe.exec(cleaned)) !== null) {
        // Skip member calls: .identifier(
        const charBefore = cleaned[m.index - 1] || '';
        if (charBefore === '.') continue;

        const name = m[1];
        if (!defined.has(name)) {
            refs.add(name);
        }
    }

    return [...refs];
}

main();
