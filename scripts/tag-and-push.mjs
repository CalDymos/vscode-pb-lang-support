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
  // abort only if suite tagging fails
  if (
  res.status !== 0 &&
  args.some(arg => arg.includes("suite"))
  ) {
    process.exit(res.status ?? 1);
  }
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
const pbpPkg = readJson("packages/pb-project-files/package.json");

const suiteVer = rootPkg.version;
const formsVer = formsPkg.version;
const langVer = langPkg.version;
const pbpVer = pbpPkg.version;

const mode = process.argv[2] ?? "all";

switch (mode) {
  case "suite":
    tagAndPush(`suite-v${suiteVer}`, `suite v${suiteVer}`);
    break;
  case "forms":
    tagAndPush(`forms-v${formsVer}`, `forms v${formsVer}`);
    break;
  case "lang":
    tagAndPush(`lang-v${langVer}`, `lang v${langVer}`);
    break;
  case "pbp":
    tagAndPush(`pbp-v${pbpVer}`, `pbp v${pbpVer}`);
    break;
  case "all":
    tagAndPush(`suite-v${suiteVer}`, `suite v${suiteVer}`);
    tagAndPush(`forms-v${formsVer}`, `forms v${formsVer}`);
    tagAndPush(`lang-v${langVer}`, `lang v${langVer}`);
    tagAndPush(`pbp-v${pbpVer}`, `pbp v${pbpVer}`);
    break;
  default:
    console.error(`Unknown mode: ${mode}`);
    console.error(`Usage: node scripts/tag-and-push.mjs [all|suite|forms|lang|pbp]`);
    process.exit(1);
}
