#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function readJson(relPath) {
  const abs = resolve(process.cwd(), relPath);
  return JSON.parse(readFileSync(abs, "utf8"));
}

function runGit(args) {
  const res = spawnSync("git", args, { stdio: "inherit", shell: false });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function tagAndPush(tag, message) {
  // git tag -a <tag> -m <message>
  runGit(["tag", "-a", tag, "-m", message]);
  // git push origin <tag>
  runGit(["push", "origin", tag]);
}

const rootPkg = readJson("package.json");
const formsPkg = readJson("packages/pb-forms-editor/package.json");
const langPkg = readJson("packages/pb-lang-support/package.json");

const suiteVer = rootPkg.version;
const formsVer = formsPkg.version;
const langVer = langPkg.version;

const mode = process.argv[2] ?? "all";

switch (mode) {
  case "suite":
    tagAndPush(`suite-v${suiteVer}`, `suite v${suiteVer}`);
    break;
  case "forms":
    tagAndPush(`pb-forms-editor-v${formsVer}`, `pb-forms-editor v${formsVer}`);
    break;
  case "lang":
    tagAndPush(`pb-lang-support-v${langVer}`, `pb-lang-support v${langVer}`);
    break;
  case "all":
    tagAndPush(`suite-v${suiteVer}`, `suite v${suiteVer}`);
    tagAndPush(`pb-forms-editor-v${formsVer}`, `pb-forms-editor v${formsVer}`);
    tagAndPush(`pb-lang-support-v${langVer}`, `pb-lang-support v${langVer}`);
    break;
  default:
    console.error(`Unknown mode: ${mode}`);
    console.error(`Usage: node scripts/tag-and-push.mjs [all|suite|forms|lang]`);
    process.exit(1);
}
