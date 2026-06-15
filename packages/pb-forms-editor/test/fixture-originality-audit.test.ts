import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function collectPbfFiles(rootDir: string): string[] {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true } as unknown);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectPbfFiles(fullPath));
      continue;
    }
    if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".pbf") {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function relativeFixturePath(fullPath: string): string {
  const normalizedFullPath = path.normalize(fullPath);
  const normalizedCwd = path.normalize(process.cwd());

  if (normalizedFullPath.startsWith(normalizedCwd + "/")) {
    return normalizedFullPath.slice(normalizedCwd.length + 1);
  }
  if (normalizedFullPath.startsWith(normalizedCwd + "\\")) {
    return normalizedFullPath.slice(normalizedCwd.length + 1);
  }

  return normalizedFullPath;
}

function findMissingRequiredHeader(pattern: RegExp, roots: string[]): string[] {
  const matches: string[] = [];

  for (const root of roots) {
    for (const filePath of collectPbfFiles(root)) {
      const text = fs.readFileSync(filePath, "utf8");
      if (!pattern.test(text)) {
        matches.push(relativeFixturePath(filePath));
      }
    }
  }

  return matches;
}

function findUnexpectedDirectiveUsages(pattern: RegExp, roots: string[]): string[] {
  const matches: string[] = [];

  for (const root of roots) {
    for (const filePath of collectPbfFiles(root)) {
      const text = fs.readFileSync(filePath, "utf8");
      if (pattern.test(text)) {
        matches.push(relativeFixturePath(filePath));
      }
    }
  }

  return matches;
}

test("keeps canonical .pbf fixtures free of regular XIncludeFile directives", () => {
  const unexpected = findUnexpectedDirectiveUsages(/(^|\r?\n)\s*XIncludeFile\b/, [
    path.join(process.cwd(), "fixtures", "smoke"),
    path.join(process.cwd(), "fixtures", "roundtrip"),
  ]);

  assert.deepEqual(
    unexpected,
    [],
    `Canonical .pbf fixtures must not contain regular XIncludeFile directives: ${unexpected.join(", ")}`
  );
});

test("keeps canonical .pbf fixtures free of ProcedureDLL stubs", () => {
  const unexpected = findUnexpectedDirectiveUsages(/(^|\r?\n)\s*ProcedureDLL\b/, [
    path.join(process.cwd(), "fixtures", "smoke"),
    path.join(process.cwd(), "fixtures", "roundtrip"),
  ]);

  assert.deepEqual(
    unexpected,
    [],
    `Canonical .pbf fixtures must not contain ProcedureDLL stubs: ${unexpected.join(", ")}`
  );
});

test("keeps canonical .pbf fixtures free of the legacy TGA decoder typo", () => {
  const unexpected = findUnexpectedDirectiveUsages(/(^|\r?\n)\s*UseJTAImageDecoder\s*\(\s*\)/, [
    path.join(process.cwd(), "fixtures", "smoke"),
    path.join(process.cwd(), "fixtures", "roundtrip"),
  ]);

  assert.deepEqual(
    unexpected,
    [],
    `Canonical .pbf fixtures must not contain the legacy UseJTAImageDecoder typo: ${unexpected.join(", ")}`
  );
});

test("keeps canonical .pbf fixtures free of testcode runtime launchers", () => {
  const unexpected = findUnexpectedDirectiveUsages(/(^|\r?\n)\s*(?:WaitWindowEvent\s*\(|Until\s+\w+_Events\s*\(|End\s*$)/i, [
    path.join(process.cwd(), "fixtures", "smoke"),
    path.join(process.cwd(), "fixtures", "roundtrip"),
  ]);

  assert.deepEqual(
    unexpected,
    [],
    `Canonical .pbf fixtures must not contain testcode runtime launchers: ${unexpected.join(", ")}`
  );
});

test("keeps canonical .pbf fixtures on the PB 6.40 header", () => {
  const unexpected = findMissingRequiredHeader(/^\uFEFF?; Form Designer for PureBasic - 6\.40(?:\r?\n|$)/, [
    path.join(process.cwd(), "fixtures", "smoke"),
    path.join(process.cwd(), "fixtures", "roundtrip"),
  ]);

  assert.deepEqual(
    unexpected,
    [],
    `Canonical .pbf fixtures must use the PB 6.40 Form Designer header: ${unexpected.join(", ")}`
  );
});


test("keeps sample .pbf files on the PB 6.40 header", () => {
  const unexpected = findMissingRequiredHeader(/^\uFEFF?; Form Designer for PureBasic - 6\.40(?:\r?\n|$)/, [
    path.join(process.cwd(), "samples"),
  ]);

  assert.deepEqual(
    unexpected,
    [],
    `Sample .pbf files must use the PB 6.40 Form Designer header: ${unexpected.join(", ")}`
  );
});
