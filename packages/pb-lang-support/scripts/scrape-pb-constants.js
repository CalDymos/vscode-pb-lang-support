#!/usr/bin/env node
/**
 * PureBasic Constants Scraper
 * Fetches ConstantsData.pbi from the official PureBasic GitHub repository and
 * converts it to src/data/pb-builtin-constants.json for use by the LSP server.
 *
 * Source file format (ConstantsData.pbi):
 *   Data$ "<FunctionName>,<1-based-param-index>,#Const1,#Const2,..."
 *   Data$ "<FunctionName>,<param-index>,#Prefix_*"   ← wildcard entry
 *   Data$ ""                                          ← terminates the list
 *
 * Output JSON schema:
 * {
 *   "functionParamConstants": {
 *     "<lowercase-funcname>": {
 *       "name": "<CanonicalName>",
 *       "params": { "<1-based-index>": ["#Const", ...] }
 *     }
 *   },
 *   "allConstants":      ["#False", "#PB_Any", ...],   // sorted, no wildcards
 *   "wildcardPrefixes":  ["#PB_Event_", ...]            // prefix without trailing *
 * }
 *
 * Usage:
 *   node scrape-pb-constants.js [--output path/to/file.json] [--url <raw-url>]
 *
 * Requires: Node.js 18+ (built-in fetch / https)
 */

'use strict';

const https = require('node:https');
const http  = require('node:http');
const fs    = require('node:fs');
const path  = require('node:path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_URL =
    'https://raw.githubusercontent.com/fantaisie-software/purebasic/refs/heads/devel/PureBasicIDE/ConstantsData.pbi';

const SOURCE_URL = (() => {
    const idx = process.argv.indexOf('--url');
    return idx !== -1 ? process.argv[idx + 1] : DEFAULT_URL;
})();

const OUTPUT_PATH = (() => {
    const idx = process.argv.indexOf('--output');
    return idx !== -1
        ? process.argv[idx + 1]
        : path.resolve(__dirname, '../src/data/pb-builtin-constants.json');
})();

const RETRIES = 3;
const TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// HTTP helper  (identical pattern to scrape-pb-docs.js)
// ---------------------------------------------------------------------------

function fetchUrl(url, attempt = 1) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { timeout: TIMEOUT }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                const loc = res.headers.location;
                const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
                return fetchUrl(next, attempt).then(resolve, reject);
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));   // Buffer – encoding TBD
            res.on('error', reject);
        });
        req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
        req.on('error', reject);
    }).catch(err => {
        if (attempt < RETRIES) {
            return new Promise(r => setTimeout(r, 500 * attempt))
                .then(() => fetchUrl(url, attempt + 1));
        }
        throw err;
    });
}

// ---------------------------------------------------------------------------
// Encoding detection
// ---------------------------------------------------------------------------

/**
 * Detects whether a Buffer starts with a UTF-8 BOM (EF BB BF) and decodes
 * accordingly.  Falls back to UTF-8 without BOM.
 *
 * ConstantsData.pbi is stored as UTF-8 with BOM in the repository.
 */
function decodeBuffer(buf) {
    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
        return buf.slice(3).toString('utf8');
    }
    return buf.toString('utf8');
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse the text content of ConstantsData.pbi.
 *
 * Returns:
 *   functionParamConstants  – Map<lowerFuncName, { name, params: Map<paramIdx, string[]> }>
 *   allConstants            – Set of concrete #Const names (no wildcards)
 *   wildcardPrefixes        – Set of prefix strings (trailing * already stripped)
 */
function parse(text) {
    const functionParamConstants = new Map();
    const allConstants           = new Set();
    const wildcardPrefixes       = new Set();

    // Match every Data$ "..." line (handles both CRLF and LF)
    const dataLineRe = /Data\$\s+"([^"]*)"/g;
    let m;

    while ((m = dataLineRe.exec(text)) !== null) {
        const line = m[1].trim();
        if (!line) continue;   // terminating empty entry

        const parts = line.split(',');
        if (parts.length < 3) continue;

        const funcName   = parts[0].trim();
        const paramIdxRaw = parts[1].trim();
        const paramIndex = parseInt(paramIdxRaw, 10);

        if (!funcName || isNaN(paramIndex)) continue;

        const constants = parts.slice(2).map(c => c.trim()).filter(c => c.startsWith('#'));
        if (constants.length === 0) continue;

        // Register function entry
        const key = funcName.toLowerCase();
        if (!functionParamConstants.has(key)) {
            functionParamConstants.set(key, { name: funcName, params: new Map() });
        }
        const entry = functionParamConstants.get(key);

        // Merge constants for same function+parameter (ConstantsData.pbi has
        // duplicate entries like "BindEvent,1,#PB_Event_*" and
        // "BindEvent,3,#PB_All" – different param indices, both valid)
        const pi = String(paramIndex);
        if (!entry.params.has(pi)) {
            entry.params.set(pi, []);
        }
        const list = entry.params.get(pi);

        for (const c of constants) {
            if (c.endsWith('*')) {
                // Wildcard: "#PB_Shortcut_*" → prefix "#PB_Shortcut_"
                wildcardPrefixes.add(c.slice(0, -1));
            } else {
                allConstants.add(c);
            }
            // Store the raw entry (including wildcards) in the mapping so that
            // callers can decide whether to expand or keep them as-is.
            if (!list.includes(c)) list.push(c);
        }
    }

    return { functionParamConstants, allConstants, wildcardPrefixes };
}

// ---------------------------------------------------------------------------
// Serialise to JSON schema
// ---------------------------------------------------------------------------

function buildJson({ functionParamConstants, allConstants, wildcardPrefixes }) {
    // functionParamConstants: Map → plain object with params as plain object
    const fcObj = {};
    for (const [key, val] of [...functionParamConstants.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const paramsObj = {};
        for (const [pi, consts] of [...val.params.entries()].sort(([a], [b]) => Number(a) - Number(b))) {
            paramsObj[pi] = consts;
        }
        fcObj[key] = { name: val.name, params: paramsObj };
    }

    return {
        functionParamConstants: fcObj,
        allConstants:    [...allConstants].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
        wildcardPrefixes: [...wildcardPrefixes].sort(),
    };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    console.log('PureBasic Constants Scraper');
    console.log(`  Source : ${SOURCE_URL}`);
    console.log(`  Output : ${OUTPUT_PATH}\n`);

    console.log('Fetching ConstantsData.pbi …');
    const buf  = await fetchUrl(SOURCE_URL);
    const text = decodeBuffer(buf);
    console.log(`  Downloaded ${buf.length} bytes, decoded as UTF-8.\n`);

    console.log('Parsing …');
    const parsed = parse(text);
    console.log(`  Functions with mappings : ${parsed.functionParamConstants.size}`);
    console.log(`  Concrete constants      : ${parsed.allConstants.size}`);
    console.log(`  Wildcard prefixes       : ${parsed.wildcardPrefixes.size}`);

    const json = buildJson(parsed);

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(json, null, 2) + '\n', 'utf8');

    console.log(`\n✓ Done → ${OUTPUT_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
