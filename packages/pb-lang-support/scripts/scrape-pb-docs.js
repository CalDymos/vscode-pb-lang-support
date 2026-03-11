#!/usr/bin/env node
/**
 * PureBasic Documentation Scraper
 * Fetches all built-in function signatures and descriptions
 * from https://www.purebasic.com/documentation/
 * and writes them to src/data/pb-builtin-functions.json
 *
 * Usage:  node scrape-pb-docs.js [--output path/to/file.json]
 * Requires: Node.js 18+ (uses built-in fetch)
 */

'use strict';

const https  = require('node:https');
const http   = require('node:http');
const fs     = require('node:fs');
const path   = require('node:path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL  = 'https://www.purebasic.com/documentation';
const DELAY_MS  = 80;   // polite delay between requests
const RETRIES   = 3;
const TIMEOUT   = 10_000;

const OUTPUT_PATH = (() => {
    const idx = process.argv.indexOf('--output');
    return idx !== -1 ? process.argv[idx + 1]
        : path.resolve(__dirname, '../src/data/pb-builtin-functions.json');
})();

// All library categories listed on the PureBasic documentation index page
const CATEGORIES = [
    '2ddrawing', 'array', 'audiocd', 'cgi', 'cipher', 'clipboard',
    'console', 'database', 'date', 'debugger', 'desktop', 'dialog',
    'dragdrop', 'file', 'filesystem', 'ftp', 'font', 'gadget', 'help',
    'http', 'image', 'imageplugin', 'json', 'library', 'list', 'mail',
    'map', 'math', 'memory', 'menu', 'movie', 'network', 'onerror',
    'packer', 'preference', 'printer', 'process', 'regularexpression',
    'requester', 'runtime', 'scintilla', 'serialport', 'sort', 'statusbar',
    'string', 'system', 'systray', 'thread', 'toolbar', 'vectordrawing',
    'webview', 'window', 'xml',
    // 2D Games & Multimedia
    'joystick', 'keyboard', 'mouse', 'music', 'screen', 'sprite',
    'sound', 'soundplugin',
    // 3D Games & Multimedia
    'engine3d', 'billboard', 'camera', 'entity', 'entityanimation',
    'gadget3d', 'joint', 'light', 'material', 'mesh', 'node',
    'nodeanimation', 'particle', 'skeleton', 'sound3d', 'specialeffect',
    'spline', 'staticgeometry', 'terrain', 'text3d', 'texture', 'vehicle',
    'vertexanimation', 'window3d',
];

// ---------------------------------------------------------------------------
// HTTP helper
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
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// HTML → text helpers  (no external dependencies)
// ---------------------------------------------------------------------------
function stripTags(html) {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

// Known PureBasic doc section headings used as section boundaries.
// Only these stop the lookahead — inline <b>FuncName</b> in a syntax line must NOT.
const SECTION_BOUNDARY =
    '(?:Syntax|Description|Parameters|Return value|Remarks|Example|See Also|Supported OS|Overview|Command Index)';

/** Extract text content between two HTML section headings. */
function extractSection(html, sectionName) {
    // Matches <b>SectionName</b> but terminates only at the next *known* section
    // header — not at inline bold tags like <b>Abs</b> inside a syntax line.
    const headerRe = new RegExp(
        `<b>\\s*${sectionName}\\s*</b>\\s*(?:</p>)?([\\s\\S]*?)` +
        `(?=<b>\\s*${SECTION_BOUNDARY}\\s*</b>|$)`, 'i'
    );
    const m = html.match(headerRe);
    return m ? m[1] : null;
}

/** Parse the Syntax section → return cleaned signature string.
 *
 * Handles both forms:
 *   AbortFTPFile(#Ftp)
 *   Result.f(.d) = Abs(Number.f(.d))   ← function name is bold inline
 */
function parseSyntax(html) {
    const section = extractSection(html, 'Syntax');
    if (!section) return null;
    const raw = stripTags(section).replace(/\n+/g, ' ').trim();
    // Remove trailing navigation artefacts (e.g. "<- Prev - Index - Next ->")
    return raw.replace(/<-.*$/, '').trim() || null;
}

/** Parse the Description section → first non-empty sentence. */
function parseDescription(html) {
    const section = extractSection(html, 'Description');
    if (!section) return null;
    const raw = stripTags(section).replace(/\n+/g, ' ').trim();
    return raw || null;
}

/** Parse Parameters table → array of "name - description" strings. */
function parseParameters(html) {
    const section = extractSection(html, 'Parameters');
    if (!section) return [];

    const params = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowM;
    while ((rowM = rowRe.exec(section)) !== null) {
        const cells = [];
        const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let cellM;
        while ((cellM = cellRe.exec(rowM[1])) !== null) {
            const t = stripTags(cellM[1]).trim();
            if (t) cells.push(t);
        }
        if (cells.length >= 2) {
            params.push(`${cells[0]} - ${cells[1]}`);
        }
    }
    return params;
}

// ---------------------------------------------------------------------------
// Category index parser  →  Map<functionName, relativeUrl>
// ---------------------------------------------------------------------------
function parseCategoryIndex(html, category) {
    const entries = new Map();
    // Links like: <a href="funcname.html">FuncName</a>
    const re = /<a\s+href="([^"]+\.html)"[^>]*>([^<]+)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
        const href = m[1];
        const name = m[2].trim();
        // Skip index/example links and navigation links
        if (
            href === 'index.html' ||
            href.startsWith('../') ||
            href.startsWith('http') ||
            /example/i.test(href) ||
            !/^[a-z0-9_]+\.html$/i.test(href)
        ) continue;
        entries.set(name, `${BASE_URL}/${category}/${href}`);
    }
    return entries;
}

// ---------------------------------------------------------------------------
// Main scraper
// ---------------------------------------------------------------------------
async function main() {
    console.log(`PureBasic Docs Scraper — output: ${OUTPUT_PATH}\n`);

    // Load existing JSON so we can merge and preserve manual entries
    let existing = {};
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
            console.log(`  Loaded ${Object.keys(existing).length} existing entries.\n`);
        } catch { /* ignore */ }
    }

    // Build function → URL map from all category indices
    const funcUrlMap = new Map(); // funcName (original case) → url
    console.log(`Fetching ${CATEGORIES.length} category index pages …`);

    for (const cat of CATEGORIES) {
        const url = `${BASE_URL}/${cat}/index.html`;
        try {
            const html = await fetchUrl(url);
            const entries = parseCategoryIndex(html, cat);
            for (const [name, funcUrl] of entries) {
                // Avoid overwriting if already found in another category
                if (!funcUrlMap.has(name.toLowerCase())) {
                    funcUrlMap.set(name.toLowerCase(), { name, url: funcUrl });
                }
            }
            process.stdout.write(`  [OK] ${cat} (${entries.size} funcs)\n`);
        } catch (err) {
            process.stdout.write(`  [SKIP] ${cat}: ${err.message}\n`);
        }
        await sleep(DELAY_MS);
    }

    console.log(`\nFound ${funcUrlMap.size} unique functions. Fetching pages …\n`);

    const result = { ...existing };
    let fetched = 0, skipped = 0, errors = 0;

    const entries = [...funcUrlMap.values()];
    for (let i = 0; i < entries.length; i++) {
        const { name, url } = entries[i];
        const progress = `[${String(i + 1).padStart(4)}/${entries.length}]`;

        // Skip if already has full documentation (non-stub)
        const exKey = Object.keys(existing).find(k => k.toLowerCase() === name.toLowerCase());
        if (exKey && existing[exKey].description !== 'PureBasic built-in function.') {
            process.stdout.write(`${progress} KEPT  ${name}\n`);
            skipped++;
            continue;
        }

        try {
            const html = await fetchUrl(url);
            const signature   = parseSyntax(html);
            const description = parseDescription(html);
            const parameters  = parseParameters(html);

            result[name] = {
                signature:   signature   ?? `${name}()`,
                description: description ?? 'PureBasic built-in function.',
                parameters,
                docUrl: url,
            };

            process.stdout.write(`${progress} OK    ${name}\n`);
            fetched++;
        } catch (err) {
            process.stdout.write(`${progress} ERR   ${name}: ${err.message}\n`);
            errors++;
            // Keep existing stub on error
            if (!result[name]) {
                result[name] = { signature: `${name}()`, description: 'PureBasic built-in function.', parameters: [] };
            }
        }

        await sleep(DELAY_MS);
    }

    // Sort keys alphabetically (case-insensitive)
    const sorted = Object.fromEntries(
        Object.entries(result).sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    );

    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(sorted, null, 2));

    console.log(`\n✓ Done.`);
    console.log(`  Fetched:  ${fetched}`);
    console.log(`  Kept:     ${skipped}`);
    console.log(`  Errors:   ${errors}`);
    console.log(`  Total:    ${Object.keys(sorted).length}`);
    console.log(`  Written → ${OUTPUT_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });