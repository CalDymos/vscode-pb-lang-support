import * as fs from "node:fs";
import * as path from "node:path";

const PROCEDURE_SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([".pb", ".pbi"]);

/** Maximum file size read during async procedure discovery (512 KB). */
export const MAX_PROCEDURE_FILE_BYTES = 512 * 1024;

export function sortUniqueProcedureNames(names: Iterable<string>): string[] {
  const unique = new Map<string, string>();
  for (const entry of names) {
    const name = (entry ?? "").trim();
    if (!name.length) continue;
    const key = name.toLowerCase();
    if (!unique.has(key)) unique.set(key, name);
  }

  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function isProcedureSourceFilePath(filePath: string): boolean {
  return PROCEDURE_SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function resolveProcedureEventFilePath(documentPath: string, eventFile?: string): string | undefined {
  const trimmedEventFile = (eventFile ?? "").trim();
  if (!trimmedEventFile.length) return undefined;

  return path.isAbsolute(trimmedEventFile)
    ? path.normalize(trimmedEventFile)
    : path.normalize(path.resolve(path.dirname(documentPath), trimmedEventFile));
}

/**
 * Returns the fixed set of procedure source paths that are always relevant
 * for a given form document: the document itself (if it's a .pb/.pbi file)
 * and the optional event file. Workspace-wide discovery is handled separately
 * via vscode.workspace.findFiles in the extension host.
 */
export function resolveFixedProcedureSourcePaths(documentPath: string, eventFile?: string): string[] {
  const resolved = new Set<string>();
  const addPath = (filePath: string | undefined) => {
    const trimmed = (filePath ?? "").trim();
    if (!trimmed.length) return;
    resolved.add(path.normalize(trimmed));
  };

  if (isProcedureSourceFilePath(documentPath)) addPath(documentPath);
  addPath(resolveProcedureEventFilePath(documentPath, eventFile));

  return Array.from(resolved).sort();
}

/**
 * Reads a procedure source file asynchronously.
 * Returns undefined when the file is unreadable or exceeds maxBytes.
 */
export async function readProcedureSourceTextAsync(
  filePath: string,
  maxBytes = MAX_PROCEDURE_FILE_BYTES
): Promise<string | undefined> {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.size > maxBytes) return undefined;
    const buf = await fs.promises.readFile(filePath);
    return buf.toString("utf8");
  } catch {
    return undefined;
  }
}