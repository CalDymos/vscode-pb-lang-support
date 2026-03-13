import * as fs from "node:fs";
import * as path from "node:path";

export function loadFixture(relPath: string): string {
  const fixturePath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found: ${relPath} -> ${fixturePath}`);
  }

  return fs.readFileSync(fixturePath, "utf8");
}
