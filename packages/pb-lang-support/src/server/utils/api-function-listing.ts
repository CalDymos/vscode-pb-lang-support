/**
 * PureBasic API function listing loader (APIFunctionListing.txt)
 *
 * The file is shipped with PureBasic (Compilers/APIFunctionListing.txt) and contains
 * OS-specific native API function names with an optional parameter list.
 *
 * Example lines:
 *   7251
 *   AbortDoc (HDC)
 *   AbortSystemShutdown
 *   AcceptEx (sListenSocket, sAcceptSocket, ...) ;handles async incoming connections
 */

import { readFileCachedWithMtime } from './file-cache';
import { simpleHash } from './hash-utils';

export interface ApiFunctionEntry {
  /** Native API name as listed in APIFunctionListing.txt (without trailing underscore). */
  apiName: string;
  /** PureBasic call name (native API name with trailing underscore). */
  pbName: string;
  /** Raw parameter list content inside parentheses (may be empty). */
  rawParams: string;
  /** Parameter tokens split by comma and trimmed. */
  params: string[];
  /** A display signature based on the listing (best-effort). */
  signature: string;
  /** Inline comment after the closing parenthesis (text after ';', trimmed). */
  comment: string;
}

export type ApiLoadResult = {
  loaded: boolean;
  /** True if the internal cache changed (new file path or new file content). */
  changed: boolean;
  /** Number of parsed entries in the cache (0 if not loaded). */
  entryCount: number;
};

function normalizeListingText(text: string): string {
  // Strip UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Extracts the comment text from a trailing comment token.
 */
function parseInlineComment(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith(';')) return raw.slice(1).trim();
  return '';
}

function parseApiFunctionLine(line: string): ApiFunctionEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // The first line is often the function count.
  if (/^\d+$/.test(trimmed)) return null;

  // Format variants:
  //   Name
  //   Name (param, param2)
  //   Name(Param)
  const openIdx = trimmed.indexOf('(');
  let apiName = '';
  let rawParams = '';
  let comment = '';

  if (openIdx >= 0) {
    apiName = trimmed.slice(0, openIdx).trim();
    const afterOpen = trimmed.slice(openIdx + 1);
    const closeIdx = afterOpen.lastIndexOf(')');

    if (closeIdx >= 0) {
      rawParams = afterOpen.slice(0, closeIdx).trim();
      // Everything after ')' may contain an inline comment (';...').
      const afterClose = afterOpen.slice(closeIdx + 1).trim();
      comment = parseInlineComment(afterClose);
    } else {
      rawParams = afterOpen.trim();
    }
  } else {
    // No parentheses – check for inline comment on a bare name line.
    const semiIdx = trimmed.search(/[;/]/);
    if (semiIdx >= 0) {
      apiName = trimmed.slice(0, semiIdx).trim();
      comment = parseInlineComment(trimmed.slice(semiIdx).trim());
    } else {
      apiName = trimmed;
    }
  }

  if (!apiName) return null;

  const pbName = apiName.endsWith('_') ? apiName : `${apiName}_`;
  const params = rawParams
    ? rawParams.split(',').map(p => p.trim()).filter(p => p.length > 0)
    : [];

  const signature = rawParams ? `${apiName}(${rawParams})` : `${apiName}()`;

  return {
    apiName,
    pbName,
    rawParams,
    params,
    signature,
    comment
  };
}

/**
 * Loads and caches entries from a PureBasic APIFunctionListing.txt.
 *
 * Notes:
 * - The listing is OS-specific (Windows/Linux/macOS).
 * - PureBasic uses the trailing underscore convention for native API calls.
 */
export class ApiFunctionListing {
  private filePath = '';
  private sourceHash = 0;
  /** mtime of the file version currently reflected in the cache. */
  private lastMtimeMs = -1;

  private entries: ApiFunctionEntry[] = [];
  private byNameLower = new Map<string, ApiFunctionEntry>();
  private byFirstCharLower = new Map<string, ApiFunctionEntry[]>();

  /** Returns the currently configured listing path (may be empty). */
  public getPath(): string {
    return this.filePath;
  }

  /** Returns the current number of cached entries. */
  public getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * (Re)load the listing file.
   *
   * Hot-path optimised: returns immediately (O(1)) when the file's mtime is
   * unchanged. `simpleHash` is only computed after an mtime change is detected,
   * and a full `rebuild()` only runs when the content hash also differs.
   */
  public load(filePath: string): ApiLoadResult {
    const nextPath = (filePath ?? '').trim();
    const pathChanged = nextPath !== this.filePath;
    this.filePath = nextPath;

    if (!this.filePath) {
      const wasLoaded = this.entries.length > 0;
      this.clear();
      return { loaded: false, changed: wasLoaded || pathChanged, entryCount: 0 };
    }

    const result = readFileCachedWithMtime(this.filePath);
    if (result == null) {
      const wasLoaded = this.entries.length > 0;
      this.clear();
      return { loaded: false, changed: wasLoaded || pathChanged, entryCount: 0 };
    }

    const { content, mtimeMs } = result;

    // Fast path: mtime unchanged → file content is identical, no hashing needed.
    if (!pathChanged && mtimeMs === this.lastMtimeMs) {
      return { loaded: true, changed: false, entryCount: this.entries.length };
    }

    const normalized = normalizeListingText(content);
    const hash = simpleHash(normalized);
    const contentChanged = hash !== this.sourceHash;

    if (!pathChanged && !contentChanged) {
      // mtime changed but content hash is identical (e.g. touch); update mtime.
      this.lastMtimeMs = mtimeMs;
      return { loaded: true, changed: false, entryCount: this.entries.length };
    }

    this.lastMtimeMs = mtimeMs;
    this.sourceHash = hash;
    this.rebuild(normalized);
    return { loaded: true, changed: true, entryCount: this.entries.length };
  }

  /**
   * Lookup by name.
   *
   * Supports both native names (e.g. "MessageBox") and PureBasic names ("MessageBox_").
   */
  public find(name: string): ApiFunctionEntry | undefined {
    const key = (name ?? '').trim().toLowerCase();
    if (!key) return undefined;
    return this.byNameLower.get(key);
  }

  /**
   * Returns entries whose native name matches the given prefix.
   *
   * If the user types the PureBasic underscore suffix (e.g. "Messag_"), the suffix
   * is ignored for matching.
   */
  public matchPrefix(prefix: string, maxResults = 100): ApiFunctionEntry[] {
    const raw = (prefix ?? '').trim();
    if (!raw) return [];

    let p = raw.toLowerCase();
    if (p.endsWith('_')) {
      p = p.slice(0, -1);
    }
    if (!p) return [];

    const bucketKey = p[0];
    const bucket = this.byFirstCharLower.get(bucketKey) ?? this.entries;

    const result: ApiFunctionEntry[] = [];
    for (const entry of bucket) {
      if (entry.apiName.toLowerCase().startsWith(p)) {
        result.push(entry);
        if (result.length >= maxResults) break;
      }
    }
    return result;
  }

  private clear(): void {
    this.sourceHash = 0;
    this.lastMtimeMs = -1;
    this.entries = [];
    this.byNameLower.clear();
    this.byFirstCharLower.clear();
  }

  private rebuild(text: string): void {
    this.entries = [];
    this.byNameLower.clear();
    this.byFirstCharLower.clear();

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const entry = parseApiFunctionLine(line);
      if (!entry) continue;

      this.entries.push(entry);

      const apiKey = entry.apiName.toLowerCase();
      const pbKey = entry.pbName.toLowerCase();

      // Keep the first occurrence to avoid churn if the listing contains duplicates.
      if (!this.byNameLower.has(apiKey)) this.byNameLower.set(apiKey, entry);
      if (!this.byNameLower.has(pbKey)) this.byNameLower.set(pbKey, entry);

      const first = apiKey[0];
      if (first) {
        let bucket = this.byFirstCharLower.get(first);
        if (!bucket) {
          bucket = [];
          this.byFirstCharLower.set(first, bucket);
        }
        bucket.push(entry);
      }
    }
  }
}