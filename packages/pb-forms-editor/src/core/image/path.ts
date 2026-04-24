export { isPbStringLiteral, parsePbStringLiteral, toPbStringLiteral } from "../parser/pb-string";
import { parsePbStringLiteral, toPbStringLiteral } from "../parser/pb-string";

export function normalizePbPath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function toPbFilePathLiteral(filePath: string): string {
  return toPbStringLiteral(normalizePbPath(filePath));
}

function splitPathRoot(value: string): { root: string; rest: string } {
  const normalized = normalizePbPath(value);
  const driveMatch = /^([A-Za-z]:)(\/.*)?$/.exec(normalized);
  if (driveMatch) {
    return { root: driveMatch[1], rest: (driveMatch[2] ?? "").replace(/^\//, "") };
  }

  if (normalized.startsWith("/")) {
    return { root: "/", rest: normalized.slice(1) };
  }

  return { root: "", rest: normalized };
}

function normalizePathSegments(value: string): string {
  const { root, rest } = splitPathRoot(value);
  const segments = rest.split("/");
  const stack: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (stack.length && stack[stack.length - 1] !== "..") {
        stack.pop();
      } else if (!root) {
        stack.push(segment);
      }
      continue;
    }
    stack.push(segment);
  }

  const joined = stack.join("/");
  if (root === "/") return joined ? `/${joined}` : "/";
  if (root) return joined ? `${root}/${joined}` : `${root}/`;
  return joined || ".";
}

function dirnamePath(value: string): string {
  const normalized = normalizePathSegments(value);
  const { root } = splitPathRoot(normalized);
  const trimmed = normalized.endsWith("/") && normalized.length > 1 ? normalized.slice(0, -1) : normalized;
  const idx = trimmed.lastIndexOf("/");
  if (idx < 0) return root ? `${root}/` : ".";
  if (idx === 0) return "/";
  return trimmed.slice(0, idx);
}

function resolveAgainst(baseDir: string, target: string): string {
  const normalizedTarget = normalizePbPath(target);
  if (/^(?:[A-Za-z]:\/|\/)/.test(normalizedTarget)) {
    return normalizePathSegments(normalizedTarget);
  }

  const base = normalizePathSegments(baseDir);
  const separator = base.endsWith("/") ? "" : "/";
  return normalizePathSegments(`${base}${separator}${normalizedTarget}`);
}

function relativePath(fromDir: string, toPath: string): string {
  const fromNormalized = normalizePathSegments(fromDir);
  const toNormalized = normalizePathSegments(toPath);
  const fromParts = splitPathRoot(fromNormalized);
  const toParts = splitPathRoot(toNormalized);

  if (fromParts.root.toLowerCase() !== toParts.root.toLowerCase()) {
    return toNormalized;
  }

  const fromSegments = fromParts.rest ? fromParts.rest.split("/").filter(Boolean) : [];
  const toSegments = toParts.rest ? toParts.rest.split("/").filter(Boolean) : [];

  let shared = 0;
  while (
    shared < fromSegments.length
    && shared < toSegments.length
    && fromSegments[shared].toLowerCase() === toSegments[shared].toLowerCase()
  ) {
    shared += 1;
  }

  const upSegments = new Array(fromSegments.length - shared).fill("..");
  const downSegments = toSegments.slice(shared);
  const result = [...upSegments, ...downSegments].join("/");
  return result || ".";
}

export function relativizeImagePath(formFilePath: string, imageRaw?: string): string | undefined {
  const normalizedFormFilePath = normalizePbPath(formFilePath);
  if (!normalizedFormFilePath || !/^(?:[A-Za-z]:\/|\/)/.test(normalizedFormFilePath)) return undefined;

  const parsedPath = parsePbStringLiteral(imageRaw);
  if (parsedPath === undefined) return undefined;

  const formDir = dirnamePath(normalizedFormFilePath);
  const absoluteImagePath = resolveAgainst(formDir, parsedPath);
  const relativeImagePath = relativePath(formDir, absoluteImagePath);
  return toPbStringLiteral(relativeImagePath);
}