import * as fs from 'fs';
import * as path from 'path';

export function uriToFsPath(uri: string): string {
  if (uri.startsWith('file://')) {
    // Remove file:// and decode
    let p = decodeURIComponent(uri.replace('file://', ''));
    // On Windows, leading slash may appear like /c:/...
    if (process.platform === 'win32' && p.startsWith('/')) {
      p = p.slice(1);
    }
    return p;
  }
  return uri;
}

export function fsPathToUri(p: string): string {
  let resolved = path.resolve(p);
  if (process.platform === 'win32') {
    // Ensure drive letter is uppercase and slashes are encoded
    resolved = resolved.replace(/\\/g, '/');
    if (!resolved.startsWith('/')) {
      resolved = '/' + resolved;
    }
  }
  return 'file://' + encodeURI(resolved);
}

export function readFileIfExistsSync(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch {}
  return null;
}

/**
 * Resolves a path to its real filesystem location by following symlinks.
 * Falls back to the input path if it does not exist (nothing to read, no symlink
 * to follow, so the lexical path is safe as a fallback).
 */
export function tryRealpath(p: string): string {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return p;
  }
}

/**
 * Checks if a given path is within any of the allowed root directories.
 * Resolves symlinks via realpathSync before the containment check so that
 * a symlink inside an allowed root pointing outside cannot bypass the boundary.
 * Non-existent paths fall back to their lexical form (they cannot be read on disk,
 * so no real traversal is possible).
 *
 * @param resolvedPath - The absolute path to check.
 * @param allowedRoots - Array of root paths that are permitted.
 * @returns `true` if the real path is within any allowed root, otherwise `false`.
 *
 * @example
 * isPathAllowed("/usr/local/bin/file.txt", ["/usr/local", "/opt"]) // true
 * isPathAllowed("/etc/passwd", ["/usr/local", "/opt"])            // false
 */
function isPathAllowed(resolvedPath: string, allowedRoots: string[]): boolean {
  // Resolve symlinks so a link inside an allowed root pointing outside is caught.
  const realPath = tryRealpath(resolvedPath);
  for (const root of allowedRoots) {
    const realRoot = tryRealpath(root);
    const rel = path.relative(realRoot, realPath);
    // rel === ''                    → exact match (path is the root itself)
    // !isAbsolute && !startsWith .. → path is a descendant of root
    if (rel === '' || (!path.isAbsolute(rel) && !rel.startsWith('..' + path.sep) && rel !== '..')) {
      return true;
    }
  }
  return false;
}

export function resolveIncludePath(
  fromDocumentUri: string,
  includeRelPath: string,
  includeDirs: string[] = [],
  workspaceRoot?: string
): string | null {
  const fromFs = uriToFsPath(fromDocumentUri);
  const fromDir = path.dirname(fromFs);

  // Build allowed root directories for path traversal protection
  const allowedRoots: string[] = [fromDir];
  if (workspaceRoot) {
    // Canonicalize the workspace root exactly as setWorkspaceRoots() does,
    // so isPathAllowed() comparisons are consistent (no trailing-sep mismatch).
    allowedRoots.push(path.resolve(workspaceRoot));
  }
  for (const dir of includeDirs) {
    if (dir) allowedRoots.push(path.normalize(dir));
  }

  const candList: string[] = [];

  // Absolute include provided - validate against allowed roots
  if (path.isAbsolute(includeRelPath)) {
    const resolved = path.resolve(includeRelPath);
    if (isPathAllowed(resolved, allowedRoots)) {
      candList.push(resolved);
    }
  }

  // Search using provided IncludePath directories (most recent first)
  for (const dir of includeDirs) {
    if (!dir) continue;
    const resolved = path.resolve(dir, includeRelPath);
    if (isPathAllowed(resolved, allowedRoots)) {
      candList.push(resolved);
    }
  }

  // Resolve path relative to the current document's directory
  const relativeResolved = path.resolve(fromDir, includeRelPath);

  // If a workspace root is defined, ensure the resolved path is within allowed roots
  // to prevent path traversal. If no workspace is present (single-file mode),
  // trust the document directory and allow normal relative resolution.
  if (workspaceRoot) {
    if (isPathAllowed(relativeResolved, allowedRoots)) {
      candList.push(relativeResolved);
    }
  } else {
    // Single-file mode: allow relative paths including '../' as expected in PureBasic
    candList.push(relativeResolved);
  }

  // As-is relative to CWD (rare in LSP), keep last - only if in allowed roots
  const cwdResolved = path.resolve(includeRelPath);
  if (isPathAllowed(cwdResolved, allowedRoots)) {
    candList.push(cwdResolved);
  }

  for (const cand of candList) {
    try {
      if (fs.existsSync(cand)) {
        // Resolve symlinks on the confirmed-existing path so the returned value
        // is always a real filesystem path. existsSync already confirmed the path
        // exists, so realpathSync.native will not throw here.
        return fs.realpathSync.native(cand);
      }
    } catch {}
  }
  return null;
}

export function normalizeDirPath(baseUri: string, dir: string): string {
  const baseFs = uriToFsPath(baseUri);
  const baseDir = path.dirname(baseFs);
  return path.isAbsolute(dir) ? path.resolve(dir) : path.resolve(baseDir, dir);
}