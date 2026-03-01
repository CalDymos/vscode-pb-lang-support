import * as fs from 'fs';
import * as path from 'path';
import { uriToFsPath } from '../utils/fs-utils';

// Simple workspace file index, only maintain .pb/.pbi file list (cache)

let roots: string[] = [];
let cachedFiles: string[] = [];
let lastBuild = 0;

const MAX_FILES = 1000; // Prevent scanning too many files
const REBUILD_INTERVAL_MS = 5000; // Minimum rebuild interval

export function setWorkspaceRoots(uris: string[]) {
  // Canonicalize each root once: resolve to absolute path and strip any trailing
  // separator. This ensures consistent matching regardless of how the URI was
  // formatted (e.g. "file:///project/" vs "file:///project").
  roots = uris.map(uri => {
    const fsPath = uriToFsPath(uri);
    return fsPath ? path.resolve(fsPath) : '';
  }).filter(Boolean);
  // Force trigger rebuild
  lastBuild = 0;
}

/**
 * Returns the workspace root that contains the given URI.
 *
 * @param uri - The URI to resolve to a workspace root.
 * @returns The matching workspace root path, or `undefined` if no roots exist.
 *
 * @example
 * getWorkspaceRootForUri("file:///home/user/project/src/file.ts")
 * // returns "/home/user/project" if it exists in roots
 */
export function getWorkspaceRootForUri(uri: string): string | undefined {
  // Canonicalize the incoming URI to an absolute path with no trailing separator,
  // matching the format used when roots were stored in setWorkspaceRoots().
  const fsPath = path.resolve(uriToFsPath(uri));
  for (const root of roots) {
    // roots are already canonicalized via path.resolve() in setWorkspaceRoots().
    if (fsPath === root) {
      return root;
    }
    // Use path.relative() for a robust containment check that avoids the
    // manual `+ path.sep` pitfall (which breaks when root has a trailing sep).
    // A relative path that doesn't start with ".." and isn't absolute means
    // fsPath is inside root. Reject empty string (means fsPath === root, handled above).
    const rel = path.relative(root, fsPath);
    if (rel && !path.isAbsolute(rel) && !rel.startsWith('..' + path.sep) && rel !== '..') {
      return root;
    }
  }
  return undefined;
}

export function getWorkspaceFiles(): string[] {
  const now = Date.now();
  if (now - lastBuild > REBUILD_INTERVAL_MS) {
    try {
      cachedFiles = buildFileList(roots);
    } catch {}
    lastBuild = now;
  }
  return cachedFiles;
}

function buildFileList(rootPaths: string[]): string[] {
  const files: string[] = [];
  const seen = new Set<string>();
  for (const root of rootPaths) {
    try {
      walk(root, files, seen);
      if (files.length >= MAX_FILES) break;
    } catch {}
  }
  return files.slice(0, MAX_FILES);
}

function walk(dir: string, out: string[], seen: Set<string>) {
  if (!dir || seen.has(dir)) return;
  seen.add(dir);
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('.')) continue; // Skip hidden directories
      walk(p, out, seen);
      if (out.length >= MAX_FILES) return;
    } else if (e.isFile()) {
      if (p.endsWith('.pb') || p.endsWith('.pbi')) {
        out.push(p);
        if (out.length >= MAX_FILES) return;
      }
    }
  }
}