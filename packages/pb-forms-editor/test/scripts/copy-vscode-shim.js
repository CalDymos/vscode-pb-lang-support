const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const srcDir = path.join(rootDir, "test", "runtime", "vscode");
const dstDir = path.join(rootDir, "out-test", "node_modules", "vscode");

fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(path.join(srcDir, "index.js"), path.join(dstDir, "index.js"));
