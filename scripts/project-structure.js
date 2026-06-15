#!/usr/bin/env node
/**
 * Generates a Markdown project structure like:
 *
 * ### Project Structure (Package)
 *
 * ```text
 * packages/foo/
 * ├── bar
 * │   └── file.txt
 * └── ...
 * ```
 *
 * Usage:
 *   node scripts/project-structure.js --rootpath ../packages/pb-forms-editor
 */
import { readdirSync, statSync, readFileSync, existsSync } from "fs";
import { join, resolve, basename, relative } from "path";
import ignore from "ignore";

// -------- GITIGNORE SETUP --------
const ig = ignore().add(["node_modules", ".git"]); // always ignore these

const gitignorePath = join(process.cwd(), ".gitignore");
if (existsSync(gitignorePath)) {
  ig.add(readFileSync(gitignorePath, "utf8"));
  console.log(`📄 Using .gitignore from: ${gitignorePath}`);
} else {
  console.warn(`⚠️  No .gitignore found at: ${gitignorePath} — using defaults only`);
}

// -------- ARG PARSER --------
const args = process.argv.slice(2);
function getArg(flag) {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
}

const rootPathArg = getArg("--rootpath");
const outFile = getArg("--out") || "project-structure.md";

if (!rootPathArg) {
  console.error("❌ Please provide --rootpath");
  process.exit(1);
}

const rootPath = resolve(rootPathArg);
const rootName = basename(rootPath);
const cwd = process.cwd();

// -------- TREE BUILDER --------
function buildTree(dir, prefix = "") {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return []; // unreadable dir (permissions etc.)
  }

  entries = entries
    .filter(entry => {
      const fullPath = join(dir, entry);
      let relPath = relative(cwd, fullPath).replace(/\\/g, "/");
      // Trailing slash für Verzeichnisse, damit Patterns wie `.dev/` korrekt matchen
      try {
        if (statSync(fullPath).isDirectory()) relPath += "/";
      } catch {
        return true; // bei Lesefehler: Eintrag behalten
      }
      return !ig.ignores(relPath);
    })
    .sort((a, b) => a.localeCompare(b));

  const lines = [];
  entries.forEach((entry, index) => {
    const fullPath = join(dir, entry);
    const isLast = index === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const isDir = statSync(fullPath).isDirectory();
    const name = isDir ? entry + "/" : entry;

    lines.push(prefix + connector + name);

    if (isDir) {
      const newPrefix = prefix + (isLast ? "    " : "│   ");
      lines.push(...buildTree(fullPath, newPrefix));
    }
  });

  return lines;
}

// -------- GENERATE --------
try {
  console.log(`🔍 Scanning: ${rootPath}`);
  const treeLines = buildTree(rootPath);

  const markdown = [
      "### Project Structure (Package)",
      "",
      "```text",
      `${rootName}/`,
      ...treeLines,
      "└── ...",
      "```",
      ""
    ].join("\n");

  const { writeFileSync } = await import("fs");
  writeFileSync(outFile, markdown, "utf8");
  console.log(`✅ Markdown saved to: ${outFile}`);
} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}